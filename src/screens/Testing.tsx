import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { 
  useFaceLandmarkDetection,
  MediapipeCamera,
  RunningMode,
  FaceLandmarkDetectionResultBundle
} from 'react-native-mediapipe';
import Svg, { Circle, Rect, Line, G } from 'react-native-svg';
import { colors } from '../theme/colors';
import { DrowsinessAlgorithm, DrowsinessState, EnrollmentData } from './Algorithm_Drowsiness';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

// Isolated component to prevent full screen re-renders
const LandmarksOverlay = memo(({ landmarksUpdateRef }: { landmarksUpdateRef: React.MutableRefObject<any> }) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    landmarksUpdateRef.current = (landmarks: any[], cameraViewSize: any, frameSize: any) => {
      setData({ landmarks, cameraViewSize, frameSize });
    };
    return () => {
      landmarksUpdateRef.current = null;
    };
  }, [landmarksUpdateRef]);

  if (!data || !data.landmarks || data.landmarks.length === 0) return null;

  try {
    const { landmarks, cameraViewSize, frameSize } = data;
    const leftEyeBox = getBoundingBox(landmarks, LEFT_EYE_INDICES);
    const rightEyeBox = getBoundingBox(landmarks, RIGHT_EYE_INDICES);
    const mouthBox = getBoundingBox(landmarks, MOUTH_INDICES);

    const vw = cameraViewSize?.width || SCREEN_WIDTH;
    const vh = cameraViewSize?.height || SCREEN_HEIGHT;
    const fw = frameSize?.width || vw;
    const fh = frameSize?.height || vh;
    
    const s = Math.max(vw / fw, vh / fh);
    const sw = fw * s;
    const sh = fh * s;
    const ox = (vw - sw) / 2;
    const oy = (vh - sh) / 2;

    const toScreenX = (x: number) => ox + x * sw;
    const toScreenY = (y: number) => oy + (1 - y) * sh;

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
        {renderBox(leftEyeBox, '#4ade80')}
        {renderBox(rightEyeBox, '#4ade80')}
        {renderBox(mouthBox, '#60a5fa')}
        {renderKeyPoint(KEY_LANDMARKS.leftEye, '#f87171')}
        {renderKeyPoint(KEY_LANDMARKS.rightEye, '#f87171')}
        {renderKeyPoint(KEY_LANDMARKS.noseTip, '#fbbf24')}
        {renderKeyPoint(KEY_LANDMARKS.mouthCenter, '#fbbf24')}
        {renderKeyPoint(KEY_LANDMARKS.leftTragion, '#c084fc')}
        {renderKeyPoint(KEY_LANDMARKS.rightTragion, '#c084fc')}
      </Svg>
    );
  } catch (error) {
    return null;
  }
});

export const TestingScreen = ({ navigation }: any) => {
  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);
  
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);
  const algorithmRef = useRef(new DrowsinessAlgorithm());
  
  const [currentEar, setCurrentEar] = useState(0);
  const [currentMar, setCurrentMar] = useState(0);
  const [drowsinessState, setDrowsinessState] = useState<DrowsinessState>(DrowsinessState.AWAKE);
  const [perclos, setPerclos] = useState(0);
  const [yawns, setYawns] = useState(0);
  const [hasAlertedYawn, setHasAlertedYawn] = useState(false);

  useEffect(() => {
    if (yawns >= 5 && !hasAlertedYawn) {
      Alert.alert("Drowsiness Alert", "You are diagnosed as drowsy");
      setHasAlertedYawn(true);
    } else if (yawns === 0 && hasAlertedYawn) {
      // Reset the alert flag when the 3-minute cycle resets the yawn counter to 0
      setHasAlertedYawn(false);
    }
  }, [yawns, hasAlertedYawn]);

  const landmarksUpdateRef = useRef<any>(null);
  const lastOverlayUpdateRef = useRef<number>(0);
  const lastProcessUpdateRef = useRef<number>(0);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
      
      try {
        const storedData = await AsyncStorage.getItem('enrollment_data');
        if (storedData) {
          const parsedData = JSON.parse(storedData) as EnrollmentData;
          setEnrollmentData(parsedData);
          algorithmRef.current.setEnrollmentData(parsedData);
        } else {
          Alert.alert(
            "No Enrollment Data", 
            "Please enroll your face first before testing.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        }
      } catch (e) {
        console.error("Failed to load enrollment data", e);
      }
    })();
  }, [navigation]);

  const faceDetectionCallback = useCallback((result: FaceLandmarkDetectionResultBundle, viewSize: any, mirrored: boolean) => {
      if (result && result.results && result.results.length > 0 && result.results[0].faceLandmarks.length > 0) {
        const currentLandmarks = result.results[0].faceLandmarks[0];

        // Process EAR and MAR
        const leftEAR = computeEAR(currentLandmarks, [33, 160, 158, 133, 153, 144]);
        const rightEAR = computeEAR(currentLandmarks, [362, 385, 387, 263, 373, 380]);
        const avgEAR = (leftEAR + rightEAR) / 2.0;
        const mar = computeMAR(currentLandmarks, [78, 82, 312, 308, 317, 87]);

        const now = Date.now();
        
        // Update UI state (throttled to ~10 FPS to avoid UI thread overload)
        if (now - lastProcessUpdateRef.current > 100) {
          setCurrentEar(avgEAR);
          setCurrentMar(mar);
          
          // algorithmRef handles null enrollmentData internally
          const { state, perclos: currentPerclos, yawns: currentYawns } = algorithmRef.current.processFrame(avgEAR, mar, now);
          setDrowsinessState(state);
          setPerclos(currentPerclos);
          setYawns(currentYawns);
          
          lastProcessUpdateRef.current = now;
        }

        // Send data directly to the isolated overlay component (with throttling for performance)
        if (landmarksUpdateRef.current) {
          if (now - lastOverlayUpdateRef.current > 50) { // Limit to ~20 FPS
            const frameSize = result.inputImageWidth && result.inputImageHeight 
              ? { width: result.inputImageWidth, height: result.inputImageHeight } 
              : null;
            landmarksUpdateRef.current(currentLandmarks, viewSize, frameSize);
            lastOverlayUpdateRef.current = now;
          }
        }
      } else {
        if (landmarksUpdateRef.current) {
          landmarksUpdateRef.current([], null, null);
        }
      }
    }, []);

  const faceDetectionSolution = useFaceLandmarkDetection(
    faceDetectionCallback,
    (error: any) => {
      console.log('Face detection error:', error);
    },
    RunningMode.LIVE_STREAM,
    'face_landmarker.task'
  );

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required for testing.</Text>
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

  const getStateColor = (state: DrowsinessState) => {
    switch (state) {
      case DrowsinessState.AWAKE: return '#4ade80'; // Green
      case DrowsinessState.A_LITTLE_DROWSY: return '#fbbf24'; // Yellow
      case DrowsinessState.DROWSY: return '#f97316'; // Orange
      case DrowsinessState.ALARM: return '#ef4444'; // Red
      default: return colors.white;
    }
  };

  return (
    <View style={styles.container}>
      <MediapipeCamera
        ref={camera}
        style={StyleSheet.absoluteFill}
        solution={faceDetectionSolution}
        activeCamera="front"
        resizeMode="cover"
      />
      
      <LandmarksOverlay landmarksUpdateRef={landmarksUpdateRef} />

      <View style={styles.topOverlay}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Algorithm Testing</Text>
      </View>

      <View style={styles.statsOverlay}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>State:</Text>
          <Text style={[styles.statValue, { color: getStateColor(drowsinessState), fontWeight: 'bold' }]}>
            {drowsinessState.replace(/_/g, ' ')}
          </Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Current EAR:</Text>
          <Text style={styles.statValue}>{currentEar.toFixed(3)}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Current MAR:</Text>
          <Text style={styles.statValue}>{currentMar.toFixed(3)}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>PERCLOS:</Text>
          <Text style={styles.statValue}>{(perclos * 100).toFixed(1)}%</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Yawns (3m):</Text>
          <Text style={styles.statValue}>{yawns}</Text>
        </View>

        {enrollmentData && (
          <View style={styles.enrollmentContainer}>
            <Text style={styles.enrollmentTitle}>Enrolled Thresholds:</Text>
            <Text style={styles.enrollmentText}>Blink EAR: {enrollmentData.blinkMinEAR.toFixed(3)}</Text>
            <Text style={styles.enrollmentText}>Closed EAR: {enrollmentData.closedEAR.toFixed(3)}</Text>
            <Text style={styles.enrollmentText}>Yawn MAR: {enrollmentData.yawnMAR.toFixed(3)}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  text: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  topOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backButtonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 60, // to balance the back button
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    padding: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statLabel: {
    color: colors.white,
    fontSize: 16,
  },
  statValue: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  enrollmentContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  enrollmentTitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  enrollmentText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'monospace',
  }
});

export default TestingScreen;
