import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { 
  faceLandmarkDetectionOnImage, 
  useFaceLandmarkDetection,
  MediapipeCamera,
  RunningMode,
  FaceLandmarkDetectionResultBundle
} from 'react-native-mediapipe';
import { colors } from '../theme/colors';

export const FaceEnrollmentScreen = ({ navigation }: any) => {
  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFaceInFrame, setIsFaceInFrame] = useState(false);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const faceDetectionSolution = useFaceLandmarkDetection(
    (result: FaceLandmarkDetectionResultBundle) => {
      if (result && result.results && result.results.length > 0 && result.results[0].faceLandmarks.length > 0) {
        setIsFaceInFrame(true);
      } else {
        setIsFaceInFrame(false);
      }
    },
    (error) => {
      console.log('Face detection error:', error);
      setIsFaceInFrame(false);
    },
    RunningMode.LIVE_STREAM,
    'face_landmarker.task'
  );

  const captureAndProcess = async () => {
    if (!camera.current || isProcessing) return;

    setIsProcessing(true);
    try {
      const photo = await camera.current.takePhoto({
        qualityPrioritization: 'speed',
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
    } catch (error) {
      console.error('Face enrollment error:', error);
      Alert.alert('Error', 'An error occurred during face enrollment.');
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
      
      <View style={styles.overlay}>
        <View style={[
          styles.faceGuide, 
          isFaceInFrame ? styles.faceGuideDetected : styles.faceGuideNotDetected
        ]} />
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
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 250,
    height: 350,
    borderWidth: 3,
    borderRadius: 20,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  faceGuideDetected: {
    borderColor: '#4ade80', // Green color for success
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderStyle: 'solid',
  },
  faceGuideNotDetected: {
    borderColor: colors.primary,
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
