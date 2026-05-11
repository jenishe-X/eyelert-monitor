import { useState, useEffect, useRef } from 'react';

export const useESP32Stream = (url: string) => {
  const [frame, setFrame] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) return;

    const connect = () => {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('Connected to ESP32 stream');
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        // Assuming the ESP32 sends frames as base64 strings or Blobs.
        // If it sends binary data, we might need to convert it to base64 for React Native Image component
        // For this example, we assume it sends base64 strings or we handle Blob conversion.
        if (typeof event.data === 'string') {
          // If it's already a base64 string
          setFrame(event.data);
        } else {
          // If it's a blob/arraybuffer, we need to read it as base64
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              // reader.result contains the base64 data URL
              setFrame(reader.result.split(',')[1] || reader.result);
            }
          };
          reader.readAsDataURL(event.data);
        }
      };

      wsRef.current.onclose = () => {
        console.log('Disconnected from ESP32 stream');
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        wsRef.current?.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return { frame, isConnected };
};
