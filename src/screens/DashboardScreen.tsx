import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useESP32Stream } from '../hooks/useESP32Stream';
import { useDrowsinessDetection } from '../hooks/useDrowsinessDetection';

export const DashboardScreen = ({ navigation }: any) => {
  const [esp32Url, setEsp32Url] = useState('http://192.168.4.1');
  const { frame, isConnected } = useESP32Stream(esp32Url);
  const { processFrame, ear, mar, perclos, yawns, isDrowsy, drowsinessState } = useDrowsinessDetection();

  useFocusEffect(
    React.useCallback(() => {
      const loadIp = async () => {
        try {
          const settingsStr = await AsyncStorage.getItem('app_settings');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.esp32Ip) {
              setEsp32Url(`http://${settings.esp32Ip}`);
            }
          }
        } catch (e) {
          console.error('Failed to load IP', e);
        }
      };
      loadIp();
    }, [])
  );

  useEffect(() => {
    if (frame) {
      processFrame(frame);
    }
  }, [frame, processFrame]);

  useEffect(() => {
    if (isDrowsy) {
      navigation.navigate('AlertModal');
    }
  }, [isDrowsy, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.streamContainer}>
        {isConnected ? (
          frame ? (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${frame}` }} 
              style={styles.streamImage} 
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.statusText}>Waiting for frames...</Text>
          )
        ) : (
          <Text style={styles.statusText}>Connecting to ESP32...</Text>
        )}
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statText}>State: {drowsinessState.replace(/_/g, ' ')}</Text>
        <Text style={styles.statText}>EAR: {ear}</Text>
        <Text style={styles.statText}>MAR: {mar}</Text>
        <Text style={styles.statText}>PERCLOS: {perclos}</Text>
        <Text style={styles.statText}>Yawns (3m): {yawns}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('FaceEnrollment')}
        >
          <Text style={styles.actionButtonText}>Enroll Face</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Testing')}
        >
          <Text style={styles.actionButtonText}>Test Alg</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Simulate')}
        >
          <Text style={styles.actionButtonText}>Simulate</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.actionButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    padding: 20,
  },
  streamContainer: {
    width: '100%',
    aspectRatio: 4/3,
    backgroundColor: '#000',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  streamImage: {
    width: '100%',
    height: '100%',
  },
  statusText: {
    color: colors.white,
    fontSize: 16,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statText: {
    fontSize: 18,
    color: colors.text,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    width: '100%',
    marginTop: 'auto',
    gap: 10,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
