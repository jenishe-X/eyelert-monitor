import React, { useEffect, useState } from 'react';
import HomeScreen from './src/components/Homescreen';
import SplashScreen from './src/components/SplashScreen';

const SPLASH_DURATION_MS = 2500;

function App(): React.JSX.Element {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsSplashVisible(false);
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, []);

  if (isSplashVisible) {
    return <SplashScreen />;
  }

  return <HomeScreen />;
}

export default App;
