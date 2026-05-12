import { useState, useEffect, useRef } from 'react';

export const useESP32Stream = (url: string) => {
  const [frame, setFrame] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isRunning = useRef(false);

  useEffect(() => {
    if (!url) return;

    // Extract IP from url (handle ws://, http://, and paths)
    const cleanIp = url.replace('ws://', '').replace('http://', '').split('/')[0];
    const captureUrl = `http://${cleanIp}/capture`;

    isRunning.current = true;

    const fetchFrame = async () => {
      if (!isRunning.current) return;

      try {
        const response = await fetch(captureUrl, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (response.ok) {
          setIsConnected(true);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setFrame(reader.result.split(',')[1] || reader.result);
            }
            if (isRunning.current) {
              // Fetch next frame with a small delay to avoid overwhelming the ESP32
              setTimeout(fetchFrame, 50);
            }
          };
          reader.onerror = () => {
            if (isRunning.current) setTimeout(fetchFrame, 1000);
          };
          reader.readAsDataURL(blob);
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

  return { frame, isConnected };
};
