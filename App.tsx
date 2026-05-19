import React, { useEffect, useState } from 'react';
import SplashScreen from './src/components/SplashScreen';
import Eyelert from './src/Eyelert';

const SPLASH_DURATION_MS = 2000;

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

  return <Eyelert />;
}

export default App;
