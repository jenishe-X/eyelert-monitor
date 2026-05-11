import { useState, useCallback } from 'react';
import { faceLandmarkDetectionOnImage } from 'react-native-mediapipe';
import RNFS from 'react-native-fs';

export const useDrowsinessDetection = () => {
  const [ear, setEar] = useState<number>(0);
  const [mar, setMar] = useState<number>(0);
  const [perclos, setPerclos] = useState<number>(0);
  const [isDrowsy, setIsDrowsy] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Constants for calculations
  const EAR_THRESHOLD = 0.25;
  const MAR_THRESHOLD = 0.5;
  const PERCLOS_THRESHOLD = 0.2; // 20% of frames in window
  
  // History for PERCLOS
  const [earHistory, setEarHistory] = useState<number[]>([]);
  const HISTORY_LENGTH = 30; // Assuming 30 frames for the window

  const calculateDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const processFrame = useCallback(async (base64Frame: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Save base64 to a temporary file
      const tempFilePath = `${RNFS.CachesDirectoryPath}/temp_frame.jpg`;
      await RNFS.writeFile(tempFilePath, base64Frame, 'base64');

      // Process the image
      const result = await faceLandmarkDetectionOnImage(tempFilePath, 'face_landmarker.task');
      
      if (result && result.results && result.results.length > 0 && result.results[0].faceLandmarks.length > 0) {
        const landmarks = result.results[0].faceLandmarks[0];
        
        // EAR Calculation (Eye Aspect Ratio)
        // Left eye landmarks: 362, 385, 387, 263, 373, 380
        // Right eye landmarks: 33, 160, 158, 133, 153, 144
        // For simplicity, we'll use approximate indices if exact aren't known, 
        // but MediaPipe Face Mesh has standard indices.
        // Let's use a simplified approach or known indices.
        // Left Eye: Horizontal (362, 263), Vertical (385, 380) and (387, 373)
        const leftEyeH = calculateDistance(landmarks[362], landmarks[263]);
        const leftEyeV1 = calculateDistance(landmarks[385], landmarks[380]);
        const leftEyeV2 = calculateDistance(landmarks[387], landmarks[373]);
        const leftEAR = (leftEyeV1 + leftEyeV2) / (2.0 * leftEyeH);

        // Right Eye: Horizontal (33, 133), Vertical (160, 144) and (158, 153)
        const rightEyeH = calculateDistance(landmarks[33], landmarks[133]);
        const rightEyeV1 = calculateDistance(landmarks[160], landmarks[144]);
        const rightEyeV2 = calculateDistance(landmarks[158], landmarks[153]);
        const rightEAR = (rightEyeV1 + rightEyeV2) / (2.0 * rightEyeH);

        const avgEAR = (leftEAR + rightEAR) / 2.0;
        setEar(Number(avgEAR.toFixed(2)));

        // MAR Calculation (Mouth Aspect Ratio)
        // Horizontal (78, 308), Vertical (13, 14) or similar
        const mouthH = calculateDistance(landmarks[78], landmarks[308]);
        const mouthV = calculateDistance(landmarks[13], landmarks[14]);
        const currentMAR = mouthV / mouthH;
        setMar(Number(currentMAR.toFixed(2)));

        // PERCLOS Calculation
        const newHistory = [...earHistory, avgEAR].slice(-HISTORY_LENGTH);
        setEarHistory(newHistory);
        
        const closedFrames = newHistory.filter(val => val < EAR_THRESHOLD).length;
        const currentPerclos = closedFrames / newHistory.length;
        setPerclos(Number(currentPerclos.toFixed(2)));

        // Drowsiness logic
        if (currentPerclos > PERCLOS_THRESHOLD || currentMAR > MAR_THRESHOLD) {
          setIsDrowsy(true);
        } else {
          setIsDrowsy(false);
        }
      }
    } catch (error) {
      console.error('Error processing frame:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, earHistory]);

  return {
    processFrame,
    ear,
    mar,
    perclos,
    isDrowsy,
  };
};
