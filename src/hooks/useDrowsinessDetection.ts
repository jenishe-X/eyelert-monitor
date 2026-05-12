import { useState, useCallback, useEffect, useRef } from 'react';
import { faceLandmarkDetectionOnImage } from 'react-native-mediapipe';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrowsinessAlgorithm, DrowsinessState } from '../screens/Algorithm_Drowsiness';

export const useDrowsinessDetection = () => {
  const [ear, setEar] = useState<number>(0);
  const [mar, setMar] = useState<number>(0);
  const [perclos, setPerclos] = useState<number>(0);
  const [isDrowsy, setIsDrowsy] = useState<boolean>(false);
  const [drowsinessState, setDrowsinessState] = useState<DrowsinessState>(DrowsinessState.AWAKE);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  const lastSaveTime = useRef<number>(0);
  const algorithmRef = useRef<DrowsinessAlgorithm>(new DrowsinessAlgorithm());

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load recent stats
        const stats = await AsyncStorage.getItem('drowsiness_stats');
        if (stats) {
          const { ear: savedEar, mar: savedMar, perclos: savedPerclos } = JSON.parse(stats);
          setEar(savedEar || 0);
          setMar(savedMar || 0);
          setPerclos(savedPerclos || 0);
        }

        // Load enrollment data and initialize algorithm
        const enrollment = await AsyncStorage.getItem('enrollment_data');
        if (enrollment) {
          algorithmRef.current.setEnrollmentData(JSON.parse(enrollment));
        }
      } catch (e) {
        console.error('Failed to load data', e);
      }
    };
    loadData();
  }, []);

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
        const leftEyeH = calculateDistance(landmarks[362], landmarks[263]);
        const leftEyeV1 = calculateDistance(landmarks[385], landmarks[380]);
        const leftEyeV2 = calculateDistance(landmarks[387], landmarks[373]);
        const leftEAR = (leftEyeV1 + leftEyeV2) / (2.0 * leftEyeH);

        const rightEyeH = calculateDistance(landmarks[33], landmarks[133]);
        const rightEyeV1 = calculateDistance(landmarks[160], landmarks[144]);
        const rightEyeV2 = calculateDistance(landmarks[158], landmarks[153]);
        const rightEAR = (rightEyeV1 + rightEyeV2) / (2.0 * rightEyeH);

        const avgEAR = (leftEAR + rightEAR) / 2.0;
        setEar(Number(avgEAR.toFixed(2)));

        // MAR Calculation (Mouth Aspect Ratio)
        const mouthH = calculateDistance(landmarks[78], landmarks[308]);
        const mouthV = calculateDistance(landmarks[13], landmarks[14]);
        const currentMAR = mouthV / mouthH;
        setMar(Number(currentMAR.toFixed(2)));

        // --- ALGORITHM INTEGRATION ---
        const timestamp = Date.now();
        const { state, perclos: currentPerclos } = algorithmRef.current.processFrame(avgEAR, currentMAR, timestamp);
        
        setPerclos(Number(currentPerclos.toFixed(2)));
        setDrowsinessState(state);
        
        // Map DrowsinessState to the boolean isDrowsy for backward compatibility with UI
        // We trigger modal for ALARM or DROWSY. A_LITTLE_DROWSY could also trigger it depending on requirements.
        // The user says "ALARM" for closed 2s, so we definitely alert for ALARM.
        if (state === DrowsinessState.ALARM || state === DrowsinessState.DROWSY) {
          setIsDrowsy(true);
        } else {
          setIsDrowsy(false);
        }

        // Save stats periodically (every 1 second) to avoid performance issues
        if (timestamp - lastSaveTime.current > 1000) {
          AsyncStorage.setItem('drowsiness_stats', JSON.stringify({ 
            ear: Number(avgEAR.toFixed(2)), 
            mar: Number(currentMAR.toFixed(2)), 
            perclos: Number(currentPerclos.toFixed(2)) 
          })).catch(e => console.error('Failed to save stats', e));
          lastSaveTime.current = timestamp;
        }
      }
    } catch (error) {
      console.error('Error processing frame:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  return {
    processFrame,
    ear,
    mar,
    perclos,
    isDrowsy,
    drowsinessState
  };
};
