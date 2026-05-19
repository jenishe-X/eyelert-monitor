import React from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';

const logo = require('../../assets/logo.png');
const SPLASH_BACKGROUND = '#990d0c';

function SplashScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SPLASH_BACKGROUND} />
      <Image
        source={logo}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Eyelert Monitor logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BACKGROUND,
    paddingHorizontal: 24,
  },
  logo: {
    width: 220,
    height: 220,
  },
});

export default SplashScreen;
