import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { 
  faceLandmarkDetectionOnImage, 
  useFaceLandmarkDetection,
  MediapipeCamera,
  RunningMode,
  FaceLandmarkDetectionResultBundle
} from 'react-native-mediapipe';
import Svg, { Circle, Rect, Line, G } from 'react-native-svg';
import { colors } from '../theme/colors';

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

export const FaceEnrollmentScreen = ({ _navigation }: any) => {
  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFaceInFrame, setIsFaceInFrame] = useState(false);
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [cameraViewSize, setCameraViewSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

  const [isMirrored, setIsMirrored] = useState(false);

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
        setLandmarks(result.results[0].faceLandmarks[0]);
        setIsMirrored(mirrored);
        if (viewSize && viewSize.width && viewSize.height) {
          setCameraViewSize(viewSize);
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
      const vw = SCREEN_WIDTH;
      const vh = SCREEN_HEIGHT;
      const fw = cameraViewSize.width;
      const fh = cameraViewSize.height;
      
      const s = Math.max(vw / fw, vh / fh);
      const sw = fw * s;
      const sh = fh * s;
      const ox = (vw - sw) / 2;
      const oy = (vh - sh) / 2;

      const toScreenX = (x: number) => {
        const nx = isMirrored ? (1 - x) : x;
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

  const captureAndProcess = async () => {
    if (!camera.current || isProcessing) return;

    setIsProcessing(true);
    try {
      const photo = await camera.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      // photo.path is something like /data/user/0/.../cache/VisionCamera-xxx.jpg
      const result = await faceLandmarkDetectionOnImage(photo.path, 'face_landmarker.task');

      if (result && result.results && result.results.length > 0 && result.results[0].faceLandmarks.length > 0) {
        Alert.alert('Success', 'Face detected and enrolled successfully!');
        // Here you would typically save the face embeddings or landmarks
      } else {
        Alert.alert('Error', 'No face detected. Please try again.');
      }
    } catch (error: any) {
      console.error('Face enrollment error:', error);
      Alert.alert('Error', error?.message ? `An error occurred: ${error.message}` : 'An error occurred during face enrollment.');
    } finally {
      setIsProcessing(false);
    }
  };

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
        <Text style={[
          styles.instructionText,
          isFaceInFrame ? styles.instructionTextDetected : null
        ]}>
          {isFaceInFrame ? 'Face Detected! Ready to capture.' : 'Position your face within the frame'}
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
        onPress={captureAndProcess}
        disabled={isProcessing}
      >
        <Text style={styles.captureButtonText}>
          {isProcessing ? 'Processing...' : 'Enroll Face'}
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
  },
  faceGuideDetected: {
    borderColor: 'rgba(74, 222, 128, 0.4)', // Lighter green color for success
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
  instructionText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    textAlign: 'center',
  },
  instructionTextDetected: {
    backgroundColor: 'rgba(74, 222, 128, 0.8)',
    color: '#000',
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
