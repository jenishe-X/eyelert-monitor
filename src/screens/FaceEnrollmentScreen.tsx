import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { 
  useFaceLandmarkDetection,
  MediapipeCamera,
  RunningMode,
  FaceLandmarkDetectionResultBundle
} from 'react-native-mediapipe';
import Svg, { Circle, Rect, Line, G } from 'react-native-svg';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export enum EnrollmentStep {
  SETUP = 0,
  EYES_OPEN_BASELINE = 1,
  BLINKS = 2,
  EYES_CLOSED = 3,
  MOUTH_NEUTRAL = 4,
  YAWN = 5,
  COMPLETED = 6
}

const STEP_INSTRUCTIONS = {
  [EnrollmentStep.SETUP]: {
    title: "Face Detection Setup",
    instructions: [
      "Place the camera so your face is front-facing, reasonably well-lit, and not too close.",
      "Ensure the green and blue boxes appear on your eyes and mouth."
    ],
    buttonText: "Start Enrollment"
  },
  [EnrollmentStep.EYES_OPEN_BASELINE]: {
    title: "Step 1: Eyes Open",
    instructions: [
      "Look straight into the camera.",
      "Keep your eyes open and relaxed.",
      "Do not blink while recording."
    ],
    buttonText: "Start Recording (3s)"
  },
  [EnrollmentStep.BLINKS]: {
    title: "Step 2: Blinks",
    instructions: [
      "Blink naturally when you see the circle.",
      "Blink 3 times during the recording."
    ],
    buttonText: "Start Recording (5s)"
  },
  [EnrollmentStep.EYES_CLOSED]: {
    title: "Step 3: Eyes Closed",
    instructions: [
      "Close both eyes and keep them closed.",
      "Keep them closed for the entire 3 seconds."
    ],
    buttonText: "Start Recording (3s)"
  },
  [EnrollmentStep.MOUTH_NEUTRAL]: {
    title: "Step 4: Mouth Neutral",
    instructions: [
      "Keep your mouth gently closed and relaxed.",
      "Do not talk or chew."
    ],
    buttonText: "Start Recording (3s)"
  },
  [EnrollmentStep.YAWN]: {
    title: "Step 5: Yawn",
    instructions: [
      "Please yawn once.",
      "Open your mouth wide and hold for a moment."
    ],
    buttonText: "Start Recording (5s)"
  },
  [EnrollmentStep.COMPLETED]: {
    title: "Enrollment Complete",
    instructions: [
      "Your facial baseline has been successfully recorded.",
      "You can now use the drowsiness monitor."
    ],
    buttonText: "Finish"
  }
};

// Key landmark indices
const KEY_LANDMARKS = {
  leftEye: 468,
  rightEye: 473,
  noseTip: 1,
  mouthCenter: 13,
  leftTragion: 234,
  rightTragion: 454,
};

const LEFT_EYE_INDICES = [33, 133, 159, 145, 153, 144, 163, 7, 161, 246, 160, 158, 157, 173];
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const MOUTH_INDICES = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

const calculateDistance = (p1: any, p2: any) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const computeEAR = (landmarks: any[], indices: number[]) => {
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];

  const v1 = calculateDistance(p2, p6);
  const v2 = calculateDistance(p3, p5);
  const h = calculateDistance(p1, p4);

  return (v1 + v2) / (2.0 * h);
};

const computeMAR = (landmarks: any[], indices: number[]) => {
  const p1 = landmarks[indices[0]];
  const p2 = landmarks[indices[1]];
  const p3 = landmarks[indices[2]];
  const p4 = landmarks[indices[3]];
  const p5 = landmarks[indices[4]];
  const p6 = landmarks[indices[5]];

  const v1 = calculateDistance(p2, p6);
  const v2 = calculateDistance(p3, p5);
  const h = calculateDistance(p1, p4);

  return (v1 + v2) / (2.0 * h);
};

export const FaceEnrollmentScreen = ({ navigation }: any) => {
  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isFaceInFrame, setIsFaceInFrame] = useState(false);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [cameraViewSize, setCameraViewSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  const [isMirrored, setIsMirrored] = useState(false);

  // Enrollment State
  const [currentStep, setCurrentStep] = useState<EnrollmentStep>(EnrollmentStep.SETUP);
  const [isRecording, setIsRecording] = useState(false);
  const [stepProgress, setStepProgress] = useState(0);
  const [enrollmentData, setEnrollmentData] = useState({
    baselineEAR: 0,
    blinkMinEAR: 0,
    closedEAR: 0,
    baselineMAR: 0,
    yawnMAR: 0,
  });

  // Refs for data collection during stream
  const currentStepRef = useRef<EnrollmentStep>(EnrollmentStep.SETUP);
  const isRecordingRef = useRef<boolean>(false);
  const stepDataRef = useRef<number[]>([]);
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const faceDetectionSolution = useFaceLandmarkDetection(
    (result: FaceLandmarkDetectionResultBundle, viewSize: any, mirrored: boolean) => {
      if (result && result.results && result.results.length > 0 && result.results[0].faceLandmarks.length > 0) {
        setIsFaceInFrame(true);
        const currentLandmarks = result.results[0].faceLandmarks[0];
        setLandmarks(currentLandmarks);
        setIsMirrored(mirrored);
        if (viewSize && viewSize.width && viewSize.height) {
          setCameraViewSize(viewSize);
        }
        if (result.inputImageWidth && result.inputImageHeight) {
          setFrameSize({ width: result.inputImageWidth, height: result.inputImageHeight });
        }

        // Collect data if recording
        if (isRecordingRef.current && currentStepRef.current !== EnrollmentStep.SETUP && currentStepRef.current !== EnrollmentStep.COMPLETED) {
          const leftEAR = computeEAR(currentLandmarks, [33, 160, 158, 133, 153, 144]);
          const rightEAR = computeEAR(currentLandmarks, [362, 385, 387, 263, 373, 380]);
          const avgEAR = (leftEAR + rightEAR) / 2.0;
          const mar = computeMAR(currentLandmarks, [78, 82, 312, 308, 317, 87]);

          if (
            currentStepRef.current === EnrollmentStep.EYES_OPEN_BASELINE ||
            currentStepRef.current === EnrollmentStep.BLINKS ||
            currentStepRef.current === EnrollmentStep.EYES_CLOSED
          ) {
            stepDataRef.current.push(avgEAR);
          } else if (
            currentStepRef.current === EnrollmentStep.MOUTH_NEUTRAL ||
            currentStepRef.current === EnrollmentStep.YAWN
          ) {
            stepDataRef.current.push(mar);
          }
        }
      } else {
        setIsFaceInFrame(false);
        setLandmarks([]);
      }
    },
    (error: any) => {
      console.log('Face detection error:', error);
      setIsFaceInFrame(false);
      Alert.alert('Face Detection Error', error?.message || String(error));
    },
    RunningMode.LIVE_STREAM,
    'face_landmarker.task'
  );

  const getBoundingBox = (points: any[], indices: number[]) => {
    if (!points || points.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    indices.forEach(idx => {
      const lm = points[idx];
      if (lm) {
        if (lm.x < minX) minX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y > maxY) maxY = lm.y;
      }
    });
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  };

  const renderLandmarks = () => {
    try {
      if (!landmarks || landmarks.length === 0) return null;

      const leftEyeBox = getBoundingBox(landmarks, LEFT_EYE_INDICES);
      const rightEyeBox = getBoundingBox(landmarks, RIGHT_EYE_INDICES);
      const mouthBox = getBoundingBox(landmarks, MOUTH_INDICES);

      // Convert normalized coordinates to screen coordinates, accounting for resizeMode="cover"
      const vw = cameraViewSize.width;
      const vh = cameraViewSize.height;
      const fw = frameSize.width || cameraViewSize.width;
      const fh = frameSize.height || cameraViewSize.height;
      
      const s = Math.max(vw / fw, vh / fh);
      const sw = fw * s;
      const sh = fh * s;
      const ox = (vw - sw) / 2;
      const oy = (vh - sh) / 2;

      const toScreenX = (x: number) => {
        const nx = x;
        return ox + nx * sw;
      };
      
      const toScreenY = (y: number) => {
        const ny = 1 - y; // Mediapipe frame is upside down on this device
        return oy + ny * sh;
      };

      const renderBox = (box: any, color: string) => {
        if (!box) return null;
        let x1 = toScreenX(box.minX);
        let x2 = toScreenX(box.maxX);
        if (x1 > x2) {
          const temp = x1;
          x1 = x2;
          x2 = temp;
        }
        let y1 = toScreenY(box.minY);
        let y2 = toScreenY(box.maxY);
        if (y1 > y2) {
          const temp = y1;
          y1 = y2;
          y2 = temp;
        }
        const width = x2 - x1;
        const height = y2 - y1;
        
        const x = x1;
        const y = y1;
        // Draw square and crosshair lines
        return (
          <G key={`${color}-${x}-${y}`}>
            <Rect x={x} y={y} width={width} height={height} stroke={color} strokeWidth="2" fill="none" />
            <Line x1={x} y1={y + height/2} x2={x + width} y2={y + height/2} stroke={color} strokeWidth="1" />
            <Line x1={x + width/2} y1={y} x2={x + width/2} y2={y + height} stroke={color} strokeWidth="1" />
          </G>
        );
      };

      const renderKeyPoint = (index: number, color: string) => {
        const lm = landmarks[index];
        if (!lm) return null;
        return (
          <Circle 
            key={`point-${index}`}
            cx={toScreenX(lm.x)} 
            cy={toScreenY(lm.y)} 
            r="4" 
            fill={color} 
          />
        );
      };

      return (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Draw bounding boxes with lines */}
          {renderBox(leftEyeBox, '#4ade80')}
          {renderBox(rightEyeBox, '#4ade80')}
          {renderBox(mouthBox, '#60a5fa')}

          {/* Draw 6 key landmarks */}
          {renderKeyPoint(KEY_LANDMARKS.leftEye, '#f87171')}
          {renderKeyPoint(KEY_LANDMARKS.rightEye, '#f87171')}
          {renderKeyPoint(KEY_LANDMARKS.noseTip, '#fbbf24')}
          {renderKeyPoint(KEY_LANDMARKS.mouthCenter, '#fbbf24')}
          {renderKeyPoint(KEY_LANDMARKS.leftTragion, '#c084fc')}
          {renderKeyPoint(KEY_LANDMARKS.rightTragion, '#c084fc')}
        </Svg>
      );
    } catch (error: any) {
      console.error('Error rendering landmarks:', error);
      return (
        <View style={{ position: 'absolute', top: 50, left: 20, right: 20, backgroundColor: 'rgba(255,0,0,0.8)', padding: 10, borderRadius: 5, zIndex: 100 }}>
          <Text style={{ color: 'white' }}>Render Error: {error?.message || String(error)}</Text>
        </View>
      );
    }
  };

  const finishStep = (step: EnrollmentStep) => {
    const data = stepDataRef.current;
    setIsRecording(false);
    isRecordingRef.current = false;
    
    if (data.length === 0) {
      Alert.alert("Error", "No face data collected. Please ensure your face is in the frame and try again.");
      return;
    }

    const nextStep = step + 1;

    setEnrollmentData(prev => {
      const newData = { ...prev };
      if (step === EnrollmentStep.EYES_OPEN_BASELINE) {
        newData.baselineEAR = data.reduce((a, b) => a + b, 0) / data.length;
      } else if (step === EnrollmentStep.BLINKS) {
        newData.blinkMinEAR = Math.min(...data);
      } else if (step === EnrollmentStep.EYES_CLOSED) {
        const sorted = [...data].sort((a, b) => a - b);
        const lowest = sorted.slice(0, Math.min(5, sorted.length));
        newData.closedEAR = lowest.reduce((a, b) => a + b, 0) / lowest.length;
      } else if (step === EnrollmentStep.MOUTH_NEUTRAL) {
        newData.baselineMAR = data.reduce((a, b) => a + b, 0) / data.length;
      } else if (step === EnrollmentStep.YAWN) {
        const sorted = [...data].sort((a, b) => b - a);
        const highest = sorted.slice(0, Math.min(5, sorted.length));
        newData.yawnMAR = highest.reduce((a, b) => a + b, 0) / highest.length;
      }
      
      if (nextStep === EnrollmentStep.COMPLETED) {
        console.log("Final Enrollment Data:", newData);
      }
      
      return newData;
    });

    setCurrentStep(nextStep);
    currentStepRef.current = nextStep;
    setStepProgress(0);
  };

  const startRecording = () => {
    if (!isFaceInFrame) {
      Alert.alert("Face Not Detected", "Please make sure your face is in the frame before starting.");
      return;
    }

    if (currentStep === EnrollmentStep.SETUP) {
      setCurrentStep(EnrollmentStep.EYES_OPEN_BASELINE);
      currentStepRef.current = EnrollmentStep.EYES_OPEN_BASELINE;
      return;
    }

    if (currentStep === EnrollmentStep.COMPLETED) {
      navigation.replace('EnrollmentResult', { data: enrollmentData });
      return;
    }

    stepDataRef.current = [];
    setIsRecording(true);
    isRecordingRef.current = true;
    setStepProgress(0);

    let duration = 3000;
    if (currentStep === EnrollmentStep.BLINKS || currentStep === EnrollmentStep.YAWN) {
      duration = 5000;
    }

    const startTime = Date.now();
    
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setStepProgress(Math.min(1, elapsed / duration));
    }, 100);

    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    stepTimerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      finishStep(currentStepRef.current);
    }, duration);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required for face enrollment.</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No front camera found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MediapipeCamera
        ref={camera}
        style={StyleSheet.absoluteFill}
        solution={faceDetectionSolution}
        activeCamera="front"
        resizeMode="cover"
      />
      
      {renderLandmarks()}

      <View style={styles.overlay}>
        <View style={[
          styles.faceGuide, 
          isFaceInFrame ? styles.faceGuideDetected : styles.faceGuideNotDetected
        ]}>
          <View style={[styles.corner, styles.topLeft, isFaceInFrame ? styles.cornerDetected : null]} />
          <View style={[styles.corner, styles.topRight, isFaceInFrame ? styles.cornerDetected : null]} />
          <View style={[styles.corner, styles.bottomLeft, isFaceInFrame ? styles.cornerDetected : null]} />
          <View style={[styles.corner, styles.bottomRight, isFaceInFrame ? styles.cornerDetected : null]} />
        </View>

        <View style={styles.instructionContainer}>
          <Text style={styles.stepTitle}>{STEP_INSTRUCTIONS[currentStep].title}</Text>
          {STEP_INSTRUCTIONS[currentStep].instructions.map((inst, index) => (
            <Text key={index} style={styles.instructionText}>• {inst}</Text>
          ))}
          
          {isRecording && (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${stepProgress * 100}%` }]} />
            </View>
          )}
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.captureButton, isRecording && styles.captureButtonDisabled]}
        onPress={startRecording}
        disabled={isRecording}
      >
        <Text style={styles.captureButtonText}>
          {isRecording ? 'Recording...' : STEP_INSTRUCTIONS[currentStep].buttonText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    flex: 1,
  },
  text: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 250,
    height: 350,
    borderWidth: 2,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    position: 'relative',
    marginBottom: 20,
  },
  faceGuideDetected: {
    borderColor: 'rgba(74, 222, 128, 0.4)',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  faceGuideNotDetected: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.primary,
  },
  cornerDetected: {
    borderColor: '#4ade80',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 20,
  },
  instructionContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    borderRadius: 15,
    width: '85%',
    alignItems: 'center',
  },
  stepTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionText: {
    color: colors.white,
    fontSize: 16,
    marginBottom: 5,
    textAlign: 'left',
    width: '100%',
  },
  progressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 5,
    marginTop: 15,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4ade80',
  },
  captureButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 5,
  },
  captureButtonDisabled: {
    backgroundColor: '#888',
  },
  captureButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
