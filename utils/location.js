import * as Location from 'expo-location';

export const getCurrentLocation = async () => {

  let { status } =
    await Location.requestForegroundPermissionsAsync();

  if (status !== 'granted') {
    alert("Permission denied");
    return;
  }

  const location =
    await Location.getCurrentPositionAsync({});

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
};