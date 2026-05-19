import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from './screens/DashboardScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { FaceEnrollmentScreen } from './screens/FaceEnrollmentScreen';
import { AlertModal } from './screens/AlertModal';
import { EnrollmentResult } from './screens/EnrollmentResult';
import { TestingScreen } from './screens/Testing';
import { SimulateScreen } from './screens/Simulate';
import { DeviceCamScreen } from './screens/DeviceCam';
import { colors } from './theme/colors';

const Stack = createNativeStackNavigator();

function Eyelert(): React.JSX.Element {
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
          name="EnrollmentResult"
          component={EnrollmentResult}
          options={{ title: 'Enrollment Results' }}
        />
        <Stack.Screen
          name="Testing"
          component={TestingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Simulate"
          component={SimulateScreen}
          options={{ title: 'Simulate' }}
        />
        <Stack.Screen
          name="DeviceCam"
          component={DeviceCamScreen}
          options={{ title: 'Device Camera', headerShown: false }}
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

export default Eyelert;
