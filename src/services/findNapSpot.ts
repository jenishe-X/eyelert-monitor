import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

const NAP_SEARCH_QUERY = 'rest area parking nap';

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}

/** Opens Google Maps with a nearby search for rest areas / safe parking. */
export async function openNearestNapSpotSearch(): Promise<void> {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    Alert.alert(
      'Location required',
      'Enable location access to find nearby places to rest.',
    );
    return;
  }

  try {
    const { latitude, longitude } = await getCurrentPosition();
    const query = encodeURIComponent(NAP_SEARCH_QUERY);
    const mapsUrl = `https://www.google.com/maps/search/${query}/@${latitude},${longitude},14z`;
    const canOpen = await Linking.canOpenURL(mapsUrl);
    if (!canOpen) {
      Alert.alert('Maps unavailable', 'Could not open maps on this device.');
      return;
    }
    await Linking.openURL(mapsUrl);
  } catch (e) {
    console.warn('Find nap spot failed:', e);
    Alert.alert(
      'Location error',
      'Could not get your location. Try again when GPS is available.',
    );
  }
}

type NavigationLike = {
  navigate: (screen: string, params?: { message?: string }) => void;
};

/** Opens voice + button prompt to answer yes/no for finding a nap spot. */
export function promptFindNapSpot(
  navigation: NavigationLike,
  message = 'You are diagnosed as drowsy.',
): void {
  navigation.navigate('NapSpotPrompt', { message });
}
