import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Tts from 'react-native-tts';
import { colors } from '../theme/colors';
import { openNearestNapSpotSearch } from '../services/findNapSpot';
import {
  destroyVoiceListeners,
  stopVoiceListening,
  waitForYesNoAnswer,
  YesNoAnswer,
  VoiceListenStatus,
} from '../services/voiceYesNo';

const NAP_PROMPT_MESSAGE =
  'Would you like to find the nearest place to take a nap? Say yes or no.';

const REMINDER_MESSAGE = 'Say yes or no.';

type NapSpotPromptParams = {
  message?: string;
};

/** Waits until TTS finishes speaking the given phrase. */
function speakAndWait(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const finishSub = Tts.addEventListener('tts-finish', () => {
      finishSub.remove();
      errorSub.remove();
      resolve();
    });
    const errorSub = Tts.addEventListener('tts-error', () => {
      finishSub.remove();
      errorSub.remove();
      reject(new Error('TTS failed'));
    });
    Tts.speak(text);
  });
}

function statusLabel(status: VoiceListenStatus): string {
  switch (status) {
    case 'listening':
      return 'Listening for your answer…';
    case 'restarting':
      return 'Still listening… say "Yes" or "No"';
    case 'waiting_permission':
      return 'Waiting for microphone access…';
    default:
      return 'Say "Yes" or "No"';
  }
}

export const NapSpotPromptModal = ({ navigation, route }: any) => {
  const params = (route?.params ?? {}) as NapSpotPromptParams;
  const drowsinessMessage = params.message ?? 'You are diagnosed as drowsy.';
  const [voiceStatus, setVoiceStatus] = useState<VoiceListenStatus>('listening');
  const [lastHeard, setLastHeard] = useState('');
  const answeredRef = useRef(false);
  const cancelledRef = useRef(false);
  const reminderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAnswer = useCallback(
    async (answer: YesNoAnswer) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      cancelledRef.current = true;
      if (reminderTimerRef.current) {
        clearInterval(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
      await stopVoiceListening();
      try {
        Tts.stop();
      } catch {
        // ignore
      }
      if (answer === 'yes') {
        try {
          await Tts.getInitStatus();
          await speakAndWait('Opening maps to find a rest area.');
        } catch {
          // ignore
        }
        await openNearestNapSpotSearch();
      } else {
        try {
          await Tts.getInitStatus();
          await speakAndWait('Okay. Stay alert and drive safely.');
        } catch {
          // ignore
        }
      }
      await destroyVoiceListeners();
      navigation.goBack();
    },
    [navigation],
  );

  useEffect(() => {
    cancelledRef.current = false;

    const speakReminder = async () => {
      if (answeredRef.current || cancelledRef.current) return;
      try {
        await Tts.getInitStatus();
        Tts.stop();
        await speakAndWait(REMINDER_MESSAGE);
      } catch {
        // ignore
      }
    };

    const runVoicePrompt = async () => {
      try {
        await Tts.getInitStatus();
        Tts.setDefaultLanguage('en-US');
        Tts.stop();
        await speakAndWait(drowsinessMessage);
        if (cancelledRef.current) return;
        await speakAndWait(NAP_PROMPT_MESSAGE);
        if (cancelledRef.current) return;

        reminderTimerRef.current = setInterval(() => {
          void speakReminder();
        }, 18000);

        await waitForYesNoAnswer({
          shouldStop: () => cancelledRef.current || answeredRef.current,
          onStatusChange: (status) => {
            if (!cancelledRef.current) setVoiceStatus(status);
          },
          onHeardPhrase: (phrase) => {
            if (!cancelledRef.current) setLastHeard(phrase);
          },
          onAnswer: (answer) => {
            void handleAnswer(answer);
          },
        });
      } catch (e) {
        console.warn('Nap prompt voice flow failed:', e);
      }
    };

    void runVoicePrompt();

    return () => {
      cancelledRef.current = true;
      if (reminderTimerRef.current) {
        clearInterval(reminderTimerRef.current);
        reminderTimerRef.current = null;
      }
      void destroyVoiceListeners();
      try {
        Tts.stop();
      } catch {
        // ignore
      }
    };
  }, [handleAnswer, drowsinessMessage]);

  return (
    <View style={styles.container}>
      <Text style={styles.alertText}>DROWSINESS DETECTED</Text>
      <Text style={styles.messageText}>{drowsinessMessage}</Text>
      <Text style={styles.questionText}>{NAP_PROMPT_MESSAGE}</Text>

      <ActivityIndicator size="large" color={colors.white} style={styles.spinner} />

      <Text style={styles.instructionText}>{statusLabel(voiceStatus)}</Text>
      <Text style={styles.voiceHintText}>Hands-free: say &quot;Yes&quot; or &quot;No&quot; aloud</Text>

      {lastHeard ? (
        <Text style={styles.heardText}>Heard: {lastHeard}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  alertText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  messageText: {
    color: colors.white,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9,
  },
  questionText: {
    color: colors.white,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  spinner: {
    marginBottom: 16,
  },
  instructionText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  voiceHintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  heardText: {
    color: colors.white,
    fontSize: 15,
    marginTop: 16,
    opacity: 0.85,
    textAlign: 'center',
  },
});
