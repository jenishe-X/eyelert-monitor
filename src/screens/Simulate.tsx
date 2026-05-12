import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';

export const SimulateScreen = ({ navigation }: any) => {
  const [isEyelertWifiConnected, setIsEyelertWifiConnected] = useState(false);
  const [esp32Ip, setEsp32Ip] = useState('192.168.4.1');
  const [isChecking, setIsChecking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadIp = async () => {
        try {
          const settingsStr = await AsyncStorage.getItem('app_settings');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.esp32Ip) {
              setEsp32Ip(settings.esp32Ip);
            }
          }
        } catch (e) {
          console.error('Failed to load IP', e);
        }
      };
      loadIp();
    }, [])
  );

  const saveIp = async (newIp: string) => {
    setEsp32Ip(newIp);
    try {
      const settingsStr = await AsyncStorage.getItem('app_settings');
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      settings.esp32Ip = newIp;
      await AsyncStorage.setItem('app_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save IP', e);
    }
  };

  const checkConnection = async () => {
    setIsChecking(true);

    let isResolved = false;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        if (!isResolved) reject(new Error('Timeout'));
      }, 5000);
    });

    try {
      // Try an HTTP fetch first to see if the device is reachable
      // Many ESP32 websocket servers will respond with a 400 or 426 to a normal HTTP GET,
      // which means the fetch promise will resolve successfully, indicating the device is connected.
      const fetchPromise = fetch(`http://${esp32Ip}`);
      await Promise.race([fetchPromise, timeoutPromise]);
      isResolved = true;
      setIsEyelertWifiConnected(true);
      setIsChecking(false);
      return;
    } catch (e) {
      isResolved = true;
      console.log("HTTP check failed, falling back to WS", e);
    }
    
    // Fallback to checking the WebSocket directly
    const ws = new WebSocket(`ws://${esp32Ip}/stream`);
    
    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        setIsEyelertWifiConnected(false);
        setIsChecking(false);
      }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(timeout);
      setIsEyelertWifiConnected(true);
      setIsChecking(false);
      ws.close();
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      setIsEyelertWifiConnected(false);
      setIsChecking(false);
      ws.close();
    };
  };

  useEffect(() => {
    if (esp32Ip) {
      checkConnection();
    }
  }, [esp32Ip]);

  const openWifiSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:root=WIFI');
    } else {
      Linking.sendIntent('android.settings.WIFI_SETTINGS');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.ipContainer}>
        <Text style={styles.ipLabel}>ESP32 IP Address:</Text>
        <TextInput
          style={styles.ipInput}
          value={esp32Ip}
          onChangeText={saveIp}
          placeholder="192.168.4.1"
          keyboardType="numeric"
        />
        <TouchableOpacity 
          style={styles.checkButton} 
          onPress={checkConnection}
          disabled={isChecking}
        >
          <Text style={styles.checkButtonText}>
            {isChecking ? 'Checking...' : 'Check'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonsContainer}>
        {/* 1. Connect Device Button */}
        <TouchableOpacity style={styles.squareButton} onPress={openWifiSettings}>
          <Text style={styles.buttonText}>Connect Device</Text>
        </TouchableOpacity>

        {/* 3. Simulate Button */}
        <TouchableOpacity 
          style={styles.squareButton} 
          onPress={() => navigation.navigate('DeviceCam')}
        >
          <Text style={styles.buttonText}>Simulate</Text>
        </TouchableOpacity>
      </View>

      {/* 2. Device Status Section */}
      <View style={styles.statusSection}>
        <Text style={styles.statusHeading}>Device Connection</Text>
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            ESP32-S3: {isEyelertWifiConnected ? "Connected" : "Not connected"}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.statusText}>
            Camera Stream: {isEyelertWifiConnected ? "15 fps" : "Waiting for link"}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.statusText}>
            Mic Keyword Spotter: {isEyelertWifiConnected ? "Ready" : "Offline"}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.statusText}>
            Speaker + Buzzer: {isEyelertWifiConnected ? "Armed" : "Offline"}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    backgroundColor: colors.white,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ipLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: 10,
  },
  ipInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
    color: colors.text,
  },
  checkButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  checkButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 40,
  },
  squareButton: {
    backgroundColor: colors.primary,
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    padding: 10,
  },
  buttonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusSection: {
    width: '100%',
    maxWidth: 400,
  },
  statusHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  statusBox: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
});
