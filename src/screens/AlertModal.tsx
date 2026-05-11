import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PermissionsAndroid, Platform } from 'react-native';
import Voice from '@react-native-voice/voice';
import Geolocation from 'react-native-geolocation-service';
import { colors } from '../theme/colors';

export const AlertModal = ({ navigation }: any) => {
  const [isListening, setIsListening] = useState(false);
  const [location, setLocation] = useState<string>('Fetching location...');

  useEffect(() => {
    // Request GPS permission and fetch location
    const fetchLocation = async () => {
      let hasPermission = false;
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        hasPermission = true; // Assuming iOS handles it via Info.plist
      }

      if (hasPermission) {
        Geolocation.getCurrentPosition(
          (position) => {
            setLocation(`Lat: ${position.coords.latitude.toFixed(4)}, Lng: ${position.coords.longitude.toFixed(4)}`);
            // Here you could send this location to a server or emergency contact
          },
          (error) => {
            setLocation('Location error: ' + error.message);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } else {
        setLocation('Location permission denied');
      }
    };

    fetchLocation();

    // Setup Voice Recognition
    Voice.onSpeechResults = (e: any) => {
      const results = e.value;
      if (results) {
        const text = results.join(' ').toLowerCase();
        if (text.includes('i am awake') || text.includes('awake')) {
          handleAwake();
        }
      }
    };

    Voice.onSpeechError = (e: any) => {
      console.error('Voice error', e);
      setIsListening(false);
    };

    startListening();

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const startListening = async () => {
    try {
      await Voice.start('en-US');
      setIsListening(true);
    } catch (e) {
      console.error('Voice start error', e);
    }
  };

  const handleAwake = async () => {
    try {
      await Voice.stop();
    } catch (e) {
      console.error(e);
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.alertText}>DROWSINESS DETECTED!</Text>
      
      <Text style={styles.locationText}>{location}</Text>
      
      <Text style={styles.instructionText}>
        {isListening ? 'Listening... Say "I am awake"' : 'Voice recognition stopped'}
      </Text>

      <TouchableOpacity 
        style={styles.button}
        onPress={handleAwake}
      >
        <Text style={styles.buttonText}>I am awake (Manual)</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  alertText: {
    color: colors.white,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  locationText: {
    color: colors.white,
    fontSize: 16,
    marginBottom: 40,
    textAlign: 'center',
  },
  instructionText: {
    color: colors.white,
    fontSize: 18,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: colors.white,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  buttonText: {
    color: colors.alert,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
