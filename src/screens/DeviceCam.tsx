import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useESP32Stream } from '../hooks/useESP32Stream';
import { useDrowsinessDetection } from '../hooks/useDrowsinessDetection';

export const DeviceCamScreen = ({ navigation }: any) => {
  const [esp32Url, setEsp32Url] = useState('ws://192.168.4.1/stream');

  useFocusEffect(
    useCallback(() => {
      const loadIp = async () => {
        try {
          const settingsStr = await AsyncStorage.getItem('app_settings');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.esp32Ip) {
              setEsp32Url(`ws://${settings.esp32Ip}/stream`);
            }
          }
        } catch (e) {
          console.error('Failed to load IP', e);
        }
      };
      loadIp();
    }, [])
  );

  const { frame, isConnected } = useESP32Stream(esp32Url);
  const { processFrame, isDrowsy, drowsinessState } = useDrowsinessDetection();

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
      {isConnected ? (
        frame ? (
          <Image 
            source={{ uri: `data:image/jpeg;base64,${frame}` }} 
            style={styles.streamImage} 
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.text}>Waiting for frames...</Text>
        )
      ) : (
        <Text style={styles.text}>Connecting to ESP32...</Text>
      )}
      
      <View style={styles.overlay}>
        <Text style={styles.statusText}>
          Drowsy Status: {drowsinessState.replace(/_/g, ' ')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamImage: {
    width: '100%',
    height: '100%',
  },
  text: {
    color: colors.white,
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
    borderRadius: 10,
  },
  statusText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  }
});
