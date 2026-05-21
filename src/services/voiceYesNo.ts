import { PermissionsAndroid, Platform } from 'react-native';
import Voice from '@react-native-voice/voice';

export type YesNoAnswer = 'yes' | 'no';

export type VoiceListenStatus = 'listening' | 'restarting' | 'waiting_permission';

const YES_PATTERN = /\b(yes|yeah|yep|yup|sure|ok|okay|affirmative)\b/i;
const NO_PATTERN = /\b(no|nope|nah|negative)\b/i;

const RESTART_DELAY_MS = 400;
const ERROR_RETRY_DELAY_MS = 800;
const MAX_RESTART_ATTEMPTS = 200;

/** Interprets spoken text as yes, no, or unrecognized. */
export function parseYesNoFromSpeech(text: string): YesNoAnswer | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;

  const hasYes = YES_PATTERN.test(normalized);
  const hasNo = NO_PATTERN.test(normalized);

  if (hasYes && !hasNo) return 'yes';
  if (hasNo && !hasYes) return 'no';
  return null;
}

export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

export async function stopVoiceListening(): Promise<void> {
  try {
    await Voice.stop();
  } catch {
    // ignore if not running
  }
  try {
    await Voice.cancel();
  } catch {
    // ignore
  }
}

export async function destroyVoiceListeners(): Promise<void> {
  await stopVoiceListening();
  try {
    await Voice.destroy();
    Voice.removeAllListeners();
  } catch (e) {
    console.warn('Voice cleanup failed:', e);
  }
}

export type WaitForYesNoOptions = {
  onAnswer: (answer: YesNoAnswer) => void;
  onHeardPhrase?: (phrase: string) => void;
  onStatusChange?: (status: VoiceListenStatus) => void;
  /** Return true to stop listening (e.g. screen unmounted). */
  shouldStop?: () => boolean;
};

function tryAnswerFromPhrases(
  phrases: string[] | undefined,
  onAnswer: (answer: YesNoAnswer) => void,
  onHeardPhrase?: (phrase: string) => void,
): boolean {
  if (!phrases?.length) return false;
  const combined = phrases.join(' ');
  onHeardPhrase?.(combined);
  const answer = parseYesNoFromSpeech(combined);
  if (answer) {
    onAnswer(answer);
    return true;
  }
  return false;
}

/**
 * Keeps the microphone open and restarts recognition until the driver says yes or no.
 * Designed for hands-free use while driving — does not give up after a single error.
 */
export function waitForYesNoAnswer(options: WaitForYesNoOptions): Promise<void> {
  let active = true;
  let restartAttempts = 0;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const halt = () => {
    active = false;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const scheduleRestart = (delayMs: number) => {
    if (!active || options.shouldStop?.()) {
      halt();
      return;
    }
    if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
      restartAttempts = 0;
    }
    restartAttempts += 1;
    options.onStatusChange?.('restarting');
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (active && !options.shouldStop?.()) {
        void startListening();
      }
    }, delayMs);
  };

  const startListening = async () => {
    if (!active || options.shouldStop?.()) {
      halt();
      return;
    }

    const hasMic = await requestMicrophonePermission();
    if (!hasMic) {
      options.onStatusChange?.('waiting_permission');
      scheduleRestart(2000);
      return;
    }

    try {
      Voice.removeAllListeners();

      Voice.onSpeechStart = () => {
        options.onStatusChange?.('listening');
      };

      Voice.onSpeechResults = (e: { value?: string[] }) => {
        if (tryAnswerFromPhrases(e.value, options.onAnswer, options.onHeardPhrase)) {
          halt();
          void stopVoiceListening();
        }
      };

      Voice.onSpeechPartialResults = (e: { value?: string[] }) => {
        tryAnswerFromPhrases(e.value, options.onAnswer, options.onHeardPhrase);
      };

      Voice.onSpeechEnd = () => {
        if (active && !options.shouldStop?.()) {
          scheduleRestart(RESTART_DELAY_MS);
        }
      };

      Voice.onSpeechError = () => {
        if (active && !options.shouldStop?.()) {
          scheduleRestart(ERROR_RETRY_DELAY_MS);
        }
      };

      await Voice.start('en-US');
      options.onStatusChange?.('listening');
    } catch (e) {
      console.warn('Voice start failed, retrying:', e);
      scheduleRestart(ERROR_RETRY_DELAY_MS);
    }
  };

  return new Promise<void>((resolve) => {
    const userOnAnswer = options.onAnswer;
    options.onAnswer = (answer: YesNoAnswer) => {
      halt();
      void stopVoiceListening();
      userOnAnswer(answer);
      resolve();
    };

    void startListening();
  });
}

/** @deprecated Use waitForYesNoAnswer for hands-free prompts. */
export type VoiceYesNoCallbacks = {
  onAnswer: (answer: YesNoAnswer) => void;
  onHeardPhrase?: (phrase: string) => void;
  onListeningChange?: (listening: boolean) => void;
  onError?: () => void;
};

export async function startVoiceYesNoListening(callbacks: VoiceYesNoCallbacks): Promise<boolean> {
  await waitForYesNoAnswer({
    onAnswer: callbacks.onAnswer,
    onHeardPhrase: callbacks.onHeardPhrase,
    onStatusChange: (status) => {
      callbacks.onListeningChange?.(status === 'listening' || status === 'restarting');
      if (status === 'waiting_permission') {
        callbacks.onError?.();
      }
    },
  });
  return true;
}
