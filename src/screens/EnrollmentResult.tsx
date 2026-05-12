import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';

export const EnrollmentResult = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { data } = (route.params || { data: { baselineEAR: 0, blinkMinEAR: 0, closedEAR: 0, baselineMAR: 0, yawnMAR: 0 } }) as any;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Enrollment Results</Text>
      
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>EAR Computation (Eye Aspect Ratio)</Text>
        <Text style={styles.text}>Baseline EAR (Eyes Open): {data.baselineEAR.toFixed(3)}</Text>
        <Text style={styles.text}>Blink Min EAR: {data.blinkMinEAR.toFixed(3)}</Text>
        <Text style={styles.text}>Closed EAR: {data.closedEAR.toFixed(3)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>MAR Computation (Mouth Aspect Ratio)</Text>
        <Text style={styles.text}>Baseline MAR (Mouth Neutral): {data.baselineMAR.toFixed(3)}</Text>
        <Text style={styles.text}>Yawn MAR: {data.yawnMAR.toFixed(3)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>PERCLOS Baseline</Text>
        <Text style={styles.text}>The blinking recording will be the baseline of the PERCLOS.</Text>
        <Text style={styles.text}>PERCLOS is computed as the percentage of time the eye is at least 80% closed over a given time window.</Text>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.navigate('Dashboard' as never)}
      >
        <Text style={styles.buttonText}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
