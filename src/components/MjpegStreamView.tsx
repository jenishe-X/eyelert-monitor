import React from 'react';
import {
  Platform,
  requireNativeComponent,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type NativeProps = {
  streamUrl: string;
  style?: ViewStyle;
};

const NativeMjpegStreamView =
  Platform.OS === 'android'
    ? requireNativeComponent<NativeProps>('MjpegStreamView')
    : null;

type Props = {
  esp32BaseUrl: string;
  style?: ViewStyle;
};

export const MjpegStreamView = ({ esp32BaseUrl, style }: Props) => {
  const cleanIp = esp32BaseUrl.replace('ws://', '').replace('http://', '').split('/')[0];
  const streamUrl = `http://${cleanIp}:81/stream`;

  if (Platform.OS !== 'android' || !NativeMjpegStreamView) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Live MJPEG stream is supported on Android only.</Text>
      </View>
    );
  }

  return <NativeMjpegStreamView streamUrl={streamUrl} style={style} />;
};

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fallbackText: {
    color: '#fff',
    textAlign: 'center',
  },
});
