/** Cooldown matches ESP32 BUZZER_DURATION (3000ms) plus a small buffer. */
const BUZZER_COOLDOWN_MS = 4000;

let lastTriggerMs = 0;

/**
 * Requests the ESP32-S3 to sound the buzzer via GET /alert.
 * Returns true if the HTTP request succeeded.
 */
export async function triggerEsp32Buzzer(esp32BaseUrl: string): Promise<boolean> {
  const now = Date.now();
  if (now - lastTriggerMs < BUZZER_COOLDOWN_MS) {
    return false;
  }
  lastTriggerMs = now;

  const base = esp32BaseUrl.replace(/\/$/, '');
  const url = `${base}/alert`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      console.warn(`ESP32 /alert returned ${response.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('ESP32 buzzer trigger failed:', e);
    return false;
  }
}
