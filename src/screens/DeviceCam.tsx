import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { NativeModules } from 'react-native';
import {
  useFaceLandmarkDetection,
  RunningMode,
  FaceLandmarkDetectionResultBundle,
} from 'react-native-mediapipe';
import { FACE_DETECTION_OPTIONS, OVERLAY_UPDATE_INTERVAL_MS } from '../config/faceDetection';
import Svg, { Circle, Rect, Line, G } from 'react-native-svg';
import { colors } from '../theme/colors';
import { MjpegStreamView } from '../components/MjpegStreamView';
import { useESP32Stream } from '../hooks/useESP32Stream';
import { DrowsinessAlgorithm, DrowsinessState, EnrollmentData } from './Algorithm_Drowsiness';
import { triggerEsp32Buzzer } from '../services/esp32Alert';
import { speakDrowsinessAlert } from '../services/drowsinessVoiceAlert';

const { FaceLandmarkDetection } = NativeModules;

const detectLiveStreamOnImage = (handle: number, imagePath: string): Promise<boolean> =>
  FaceLandmarkDetection.detectLiveStreamOnImage(handle, imagePath);

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

/** ESP32 MJPEG uses FIT_XY — map normalized landmarks directly to view size. */
const LandmarksOverlay = memo(({ landmarksUpdateRef }: { landmarksUpdateRef: React.MutableRefObject<any> }) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    landmarksUpdateRef.current = (landmarks: any[], viewSize: any) => {
      setData({ landmarks, viewSize });
    };
    return () => {
      landmarksUpdateRef.current = null;
    };
  }, [landmarksUpdateRef]);

  if (!data || !data.landmarks || data.landmarks.length === 0) return null;

  try {
    const { landmarks, viewSize } = data;
    const leftEyeBox = getBoundingBox(landmarks, LEFT_EYE_INDICES);
    const rightEyeBox = getBoundingBox(landmarks, RIGHT_EYE_INDICES);
    const mouthBox = getBoundingBox(landmarks, MOUTH_INDICES);

    const vw = viewSize?.width || SCREEN_WIDTH;
    const vh = viewSize?.height || (SCREEN_WIDTH * 3) / 4;

    const toScreenX = (x: number) => x * vw;
    const toScreenY = (y: number) => y * vh;

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
          <Line x1={x} y1={y + height / 2} x2={x + width} y2={y + height / 2} stroke={color} strokeWidth="1" />
          <Line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth="1" />
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
  } catch {
    return null;
  }
});

export const DeviceCamScreen = ({ navigation }: any) => {
  const [esp32Url, setEsp32Url] = useState('http://192.168.4.1');
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentData | null>(null);
  const [hasAlertedYawn, setHasAlertedYawn] = useState(false);
  const [isDrowsy, setIsDrowsy] = useState(false);

  const [ear, setEar] = useState(0);
  const [mar, setMar] = useState(0);
  const [perclos, setPerclos] = useState(0);
  const [yawns, setYawns] = useState(0);
  const [drowsinessState, setDrowsinessState] = useState<DrowsinessState>(DrowsinessState.AWAKE);

  const algorithmRef = useRef(new DrowsinessAlgorithm());
  const prevDrowsinessStateRef = useRef<DrowsinessState>(DrowsinessState.AWAKE);
  const landmarksUpdateRef = useRef<any>(null);
  const lastOverlayUpdateRef = useRef<number>(0);
  const lastProcessUpdateRef = useRef<number>(0);
  const isDetectingFrameRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const loadSettings = async () => {
        try {
          const settingsStr = await AsyncStorage.getItem('app_settings');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.esp32Ip) {
              setEsp32Url(`http://${settings.esp32Ip}`);
            }
          }

          const storedData = await AsyncStorage.getItem('enrollment_data');
          if (storedData) {
            const parsed = JSON.parse(storedData) as EnrollmentData;
            setEnrollmentData(parsed);
            algorithmRef.current.setEnrollmentData(parsed);
          } else {
            Alert.alert(
              'No Enrollment Data',
              'Please enroll your face first before testing.',
              [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
          }
        } catch (e) {
          console.error('Failed to load settings', e);
        }
      };
      loadSettings();
    }, [navigation])
  );

  const { detectionPath, isConnected } = useESP32Stream(esp32Url);

  const faceDetectionCallback = useCallback(
    (result: FaceLandmarkDetectionResultBundle, viewSize: any) => {
      if (result?.results?.length > 0 && result.results[0].faceLandmarks.length > 0) {
        const currentLandmarks = result.results[0].faceLandmarks[0];

        const leftEAR = computeEAR(currentLandmarks, [33, 160, 158, 133, 153, 144]);
        const rightEAR = computeEAR(currentLandmarks, [362, 385, 387, 263, 373, 380]);
        const avgEAR = (leftEAR + rightEAR) / 2.0;
        const currentMar = computeMAR(currentLandmarks, [78, 82, 312, 308, 317, 87]);

        const now = Date.now();

        if (now - lastProcessUpdateRef.current > 100) {
          setEar(avgEAR);
          setMar(currentMar);

          const { state, perclos: currentPerclos, yawns: currentYawns } =
            algorithmRef.current.processFrame(avgEAR, currentMar, now);
          setDrowsinessState(state);
          setPerclos(currentPerclos);
          setYawns(currentYawns);
          setIsDrowsy(
            state === DrowsinessState.ALARM || state === DrowsinessState.DROWSY
          );

          lastProcessUpdateRef.current = now;
        }

        if (landmarksUpdateRef.current) {
          if (now - lastOverlayUpdateRef.current > OVERLAY_UPDATE_INTERVAL_MS) {
            landmarksUpdateRef.current(currentLandmarks, viewSize);
            lastOverlayUpdateRef.current = now;
          }
        }
      } else if (landmarksUpdateRef.current) {
        landmarksUpdateRef.current([], null);
      }
    },
    []
  );

  const faceDetectionSolution = useFaceLandmarkDetection(
    faceDetectionCallback,
    (error: any) => {
      console.log('ESP32 face detection error:', error);
    },
    RunningMode.LIVE_STREAM,
    'face_landmarker.task',
    { ...FACE_DETECTION_OPTIONS, mirrorMode: 'no-mirror' }
  );

  useEffect(() => {
    const handle = (faceDetectionSolution as { detectorHandle?: number }).detectorHandle;
    if (!detectionPath || handle === undefined) return;
    if (isDetectingFrameRef.current) return;

    isDetectingFrameRef.current = true;
    detectLiveStreamOnImage(handle, detectionPath)
      .catch((e: unknown) => console.error('ESP32 frame detection failed:', e))
      .finally(() => {
        isDetectingFrameRef.current = false;
      });
  }, [detectionPath, faceDetectionSolution]);

  useEffect(() => {
    if (isDrowsy) {
      navigation.navigate('AlertModal');
    }
  }, [isDrowsy, navigation]);

  useEffect(() => {
    const prev = prevDrowsinessStateRef.current;
    const enteredDrowsy =
      (drowsinessState === DrowsinessState.DROWSY || drowsinessState === DrowsinessState.ALARM) &&
      prev !== DrowsinessState.DROWSY &&
      prev !== DrowsinessState.ALARM;
    const enteredAlarm =
      drowsinessState === DrowsinessState.ALARM && prev !== DrowsinessState.ALARM;

    if (enteredDrowsy) {
      speakDrowsinessAlert();
    }
    if (enteredAlarm && isConnected) {
      triggerEsp32Buzzer(esp32Url);
    }
    prevDrowsinessStateRef.current = drowsinessState;
  }, [drowsinessState, esp32Url, isConnected]);

  useEffect(() => {
    if (yawns >= 5 && !hasAlertedYawn) {
      speakDrowsinessAlert();
      Alert.alert('Drowsiness Alert', 'You are diagnosed as drowsy');
      setHasAlertedYawn(true);
    } else if (yawns === 0 && hasAlertedYawn) {
      setHasAlertedYawn(false);
    }
  }, [yawns, hasAlertedYawn]);

  const getStateColor = (state: DrowsinessState) => {
    switch (state) {
      case DrowsinessState.AWAKE:
        return '#4ade80';
      case DrowsinessState.DROWSY:
        return '#f97316';
      case DrowsinessState.ALARM:
        return '#ef4444';
      default:
        return colors.white;
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.streamContainer}
        onLayout={faceDetectionSolution.cameraViewLayoutChangeHandler}
      >
        <MjpegStreamView esp32BaseUrl={esp32Url} style={styles.streamImage} />
        <LandmarksOverlay landmarksUpdateRef={landmarksUpdateRef} />
        {!isConnected && (
          <View style={styles.connectingOverlay}>
            <Text style={styles.text}>Connecting to ESP32...</Text>
          </View>
        )}
      </View>

      <View style={styles.topOverlay}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ESP32 Monitor</Text>
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
          <Text style={styles.statValue}>{ear.toFixed(3)}</Text>
        </View>

        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Current MAR:</Text>
          <Text style={styles.statValue}>{mar.toFixed(3)}</Text>
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
  streamContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: '15%',
  },
  streamImage: {
    width: '100%',
    height: '100%',
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: colors.white,
    textAlign: 'center',
    fontSize: 16,
  },
  topOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
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
    marginRight: 60,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 15,
    padding: 20,
    zIndex: 10,
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
  },
});
