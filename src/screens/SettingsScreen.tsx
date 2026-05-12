import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';

export const SettingsScreen = ({ navigation }: any) => {
  const [esp32Ip, setEsp32Ip] = useState('192.168.4.1');
  const [earThreshold, setEarThreshold] = useState('0.25');
  const [marThreshold, setMarThreshold] = useState('0.50');
  
  // Enrollment results state
  const [baselineEAR, setBaselineEAR] = useState('0');
  const [blinkMinEAR, setBlinkMinEAR] = useState('0');
  const [closedEAR, setClosedEAR] = useState('0');
  const [baselineMAR, setBaselineMAR] = useState('0');
  const [yawnMAR, setYawnMAR] = useState('0');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsStr = await AsyncStorage.getItem('app_settings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          if (settings.esp32Ip) setEsp32Ip(settings.esp32Ip);
          if (settings.earThreshold) setEarThreshold(settings.earThreshold);
          if (settings.marThreshold) setMarThreshold(settings.marThreshold);
        }

        const enrollmentStr = await AsyncStorage.getItem('enrollment_data');
        if (enrollmentStr) {
          const enrollment = JSON.parse(enrollmentStr);
          if (enrollment.baselineEAR !== undefined) setBaselineEAR(String(enrollment.baselineEAR));
          if (enrollment.blinkMinEAR !== undefined) setBlinkMinEAR(String(enrollment.blinkMinEAR));
          if (enrollment.closedEAR !== undefined) setClosedEAR(String(enrollment.closedEAR));
          if (enrollment.baselineMAR !== undefined) setBaselineMAR(String(enrollment.baselineMAR));
          if (enrollment.yawnMAR !== undefined) setYawnMAR(String(enrollment.yawnMAR));
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      await AsyncStorage.setItem('app_settings', JSON.stringify({
        esp32Ip,
        earThreshold,
        marThreshold,
      }));
      
      await AsyncStorage.setItem('enrollment_data', JSON.stringify({
        baselineEAR: parseFloat(baselineEAR) || 0,
        blinkMinEAR: parseFloat(blinkMinEAR) || 0,
        closedEAR: parseFloat(closedEAR) || 0,
        baselineMAR: parseFloat(baselineMAR) || 0,
        yawnMAR: parseFloat(yawnMAR) || 0,
      }));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.sectionTitle}>General Settings</Text>

        <Text style={styles.label}>ESP32-S3 IP Address</Text>
        <TextInput
          style={styles.input}
          value={esp32Ip}
          onChangeText={setEsp32Ip}
          placeholder="e.g. 192.168.4.1"
          keyboardType="numeric"
        />

        <Text style={styles.label}>EAR Threshold</Text>
        <TextInput
          style={styles.input}
          value={earThreshold}
          onChangeText={setEarThreshold}
          placeholder="e.g. 0.25"
          keyboardType="numeric"
        />

        <Text style={styles.label}>MAR Threshold</Text>
        <TextInput
          style={styles.input}
          value={marThreshold}
          onChangeText={setMarThreshold}
          placeholder="e.g. 0.50"
          keyboardType="numeric"
        />

        <Text style={styles.sectionTitle}>Face Enrollment Results</Text>
        
        <Text style={styles.label}>Baseline EAR (Eyes Open)</Text>
        <TextInput
          style={styles.input}
          value={baselineEAR}
          onChangeText={setBaselineEAR}
          placeholder="e.g. 0.35"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Blink Min EAR</Text>
        <TextInput
          style={styles.input}
          value={blinkMinEAR}
          onChangeText={setBlinkMinEAR}
          placeholder="e.g. 0.20"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Closed EAR</Text>
        <TextInput
          style={styles.input}
          value={closedEAR}
          onChangeText={setClosedEAR}
          placeholder="e.g. 0.15"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Baseline MAR (Mouth Neutral)</Text>
        <TextInput
          style={styles.input}
          value={baselineMAR}
          onChangeText={setBaselineMAR}
          placeholder="e.g. 0.40"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Yawn MAR</Text>
        <TextInput
          style={styles.input}
          value={yawnMAR}
          onChangeText={setYawnMAR}
          placeholder="e.g. 0.80"
          keyboardType="numeric"
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  form: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 10,
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
