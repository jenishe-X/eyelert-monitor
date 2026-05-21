import { useState, useEffect, useRef } from 'react';
import RNFS from 'react-native-fs';

/** Match MediaPipe live-stream throttle (~20 FPS) without overloading ESP32 /capture. */
const DETECTION_INTERVAL_MS = 50;

export const useESP32Stream = (url: string) => {
  const [detectionPath, setDetectionPath] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const isRunning = useRef(false);
  const isFetching = useRef(false);
  const frameCount = useRef(0);

  useEffect(() => {
    if (!url) return;

    const cleanIp = url.replace('ws://', '').replace('http://', '').split('/')[0];
    const captureUrl = `http://${cleanIp}/capture`;

    isRunning.current = true;

    const fetchDetectionFrame = async () => {
      if (!isRunning.current || isFetching.current) return;
      isFetching.current = true;

      try {
        const tempFilePath = `${RNFS.CachesDirectoryPath}/detect_frame_${frameCount.current % 3}.jpg`;
        frameCount.current++;

        const result = await RNFS.downloadFile({
          fromUrl: captureUrl,
          toFile: tempFilePath,
          background: false,
          cacheable: false,
        }).promise;

        if (result.statusCode === 200) {
          setIsConnected(true);
          setDetectionPath(tempFilePath);
        } else {
          setIsConnected(false);
        }
      } catch {
        setIsConnected(false);
      } finally {
        isFetching.current = false;
      }
    };

    fetchDetectionFrame();
    const interval = setInterval(fetchDetectionFrame, DETECTION_INTERVAL_MS);

    return () => {
      isRunning.current = false;
      clearInterval(interval);
    };
  }, [url]);

  return { detectionPath, isConnected };
};
