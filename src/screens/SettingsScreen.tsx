import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme/colors';

export const SettingsScreen = ({ navigation }: any) => {
  const [esp32Ip, setEsp32Ip] = useState('192.168.4.1');
  const [earThreshold, setEarThreshold] = useState('0.25');
  const [marThreshold, setMarThreshold] = useState('0.50');

  const handleSave = () => {
    // In a real app, save these to AsyncStorage or Context
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
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

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </View>
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
    marginTop: 20,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
