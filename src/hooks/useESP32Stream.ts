import { useState, useEffect, useRef } from 'react';
import RNFS from 'react-native-fs';

export const useESP32Stream = (url: string) => {
  const [framePath, setFramePath] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const isRunning = useRef(false);

  useEffect(() => {
    if (!url) return;

    // Extract IP from url (handle ws://, http://, and paths)
    const cleanIp = url.replace('ws://', '').replace('http://', '').split('/')[0];
    const captureUrl = `http://${cleanIp}/capture`;
    
    // Set MJPEG stream URL (ESP32-CAM usually serves stream on port 81)
    setStreamUrl(`http://${cleanIp}:81/stream`);

    isRunning.current = true;
    let frameCount = 0;

    const fetchFrame = async () => {
      if (!isRunning.current) return;

      try {
        // Use a rotating set of temp files to prevent cache issues while avoiding filling up disk
        const tempFilePath = `${RNFS.CachesDirectoryPath}/temp_frame_${frameCount % 3}.jpg`;
        frameCount++;

        // Download directly to file, skipping base64 conversion completely
        const result = await RNFS.downloadFile({
          fromUrl: captureUrl,
          toFile: tempFilePath,
          background: false,
          cacheable: false,
        }).promise;

        if (result.statusCode === 200) {
          setIsConnected(true);
          // Pass the absolute file path directly (without file:// prefix)
          // react-native-mediapipe expects the raw path
          setFramePath(tempFilePath);
          if (isRunning.current) {
            // Fetch next frame with a delay (e.g., 5-10 FPS is enough for detection)
            setTimeout(fetchFrame, 150);
          }
        } else {
          setIsConnected(false);
          if (isRunning.current) setTimeout(fetchFrame, 1000);
        }
      } catch (error) {
        setIsConnected(false);
        if (isRunning.current) setTimeout(fetchFrame, 1000);
      }
    };

    fetchFrame();

    return () => {
      isRunning.current = false;
    };
  }, [url]);

  return { framePath, streamUrl, isConnected };
};
