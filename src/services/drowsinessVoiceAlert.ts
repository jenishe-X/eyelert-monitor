import Tts from 'react-native-tts';

export const DROWSINESS_VOICE_MESSAGE = 'You are detected as drowsy.';

const VOICE_COOLDOWN_MS = 10000;

let lastSpeakMs = 0;
let ttsReady = false;

async function ensureTtsReady(): Promise<void> {
  if (ttsReady) return;
  await Tts.getInitStatus();
  Tts.setDefaultLanguage('en-US');
  ttsReady = true;
}

/** Speaks the drowsiness alert once per cooldown window. */
export async function speakDrowsinessAlert(): Promise<void> {
  const now = Date.now();
  if (now - lastSpeakMs < VOICE_COOLDOWN_MS) {
    return;
  }
  lastSpeakMs = now;

  try {
    await ensureTtsReady();
    Tts.stop();
    Tts.speak(DROWSINESS_VOICE_MESSAGE);
  } catch (e) {
    console.warn('Drowsiness voice alert failed:', e);
  }
}

export function stopDrowsinessAlertVoice(): void {
  try {
    Tts.stop();
  } catch {
    // ignore
  }
}
