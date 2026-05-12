import MapView from "react-native-maps";

export default function MapScreen() {

  return (

    <MapView
      style={{ flex:1 }}
      initialRegion={{
        latitude:25.6,
        longitude:85.1,
        latitudeDelta:0.05,
        longitudeDelta:0.05
      }}
    />

  );
}