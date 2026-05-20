import { Delegate } from 'react-native-mediapipe';

/** Shared MediaPipe options — tuned for low latency on mid-range Android phones. */
export const FACE_DETECTION_OPTIONS = {
  numFaces: 1,
  minFaceDetectionConfidence: 0.3,
  minFacePresenceConfidence: 0.3,
  minTrackingConfidence: 0.3,
  delegate: Delegate.GPU,
  frameSkip: 1,
} as const;

/** Overlay refresh cap (ms). Lower = snappier boxes; keep >= 33 to avoid JS thread overload. */
export const OVERLAY_UPDATE_INTERVAL_MS = 33;
