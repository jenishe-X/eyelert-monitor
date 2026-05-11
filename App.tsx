import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { FaceEnrollmentScreen } from './src/screens/FaceEnrollmentScreen';
import { AlertModal } from './src/screens/AlertModal';
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();

function App(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.white,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}>
        <Stack.Screen 
          name="Dashboard" 
          component={DashboardScreen} 
          options={{ title: 'Eyelert Monitor' }}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen} 
        />
        <Stack.Screen 
          name="FaceEnrollment" 
          component={FaceEnrollmentScreen}
          options={{ title: 'Face Enrollment' }}
        />
        <Stack.Screen 
          name="AlertModal" 
          component={AlertModal} 
          options={{ 
            presentation: 'fullScreenModal',
            headerShown: false,
          }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
