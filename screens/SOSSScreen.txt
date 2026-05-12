import React, {
  useState
} from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert
} from "react-native";

import * as Location
from "expo-location";

import API
from "../services/api";

export default function SOSScreen({ route }) {

  const { userId } = route.params;

  const [loading, setLoading] =
  useState(false);

  const [selectedEmergency,
  setSelectedEmergency] =
  useState("Accident");

  const sendSOS = async () => {

    try {

      setLoading(true);

      // LOCATION PERMISSION

      let { status } =
      await Location.requestForegroundPermissionsAsync();

      if(status !== "granted"){

        Alert.alert(
          "Permission Denied"
        );

        return;

      }

      // GET LOCATION

      let location =
      await Location.getCurrentPositionAsync({});

      const latitude =
      location.coords.latitude;

      const longitude =
      location.coords.longitude;

      // SEND TO BACKEND

      const response =
      await API.post(
        "/sos/create",
        {

          userId,

          emergencyType:
          selectedEmergency,

          latitude,

          longitude

        }
      );

      Alert.alert(
        "SOS Sent Successfully"
      );

      console.log(response.data);

    } catch(error){

      console.log(error);

      Alert.alert(
        "Failed To Send SOS"
      );

    } finally {

      setLoading(false);

    }

  };

  return (

    <View style={styles.container}>

      <Text style={styles.heading}>
        🚨 Emergency SOS
      </Text>

      <Text style={styles.subHeading}>
        Select Emergency Type
      </Text>

      {/* EMERGENCY BUTTONS */}

      <View style={styles.buttonContainer}>

        {

          [
            "Accident",
            "Flood",
            "Fire",
            "Earthquake"
          ].map((item)=>(

            <TouchableOpacity

              key={item}

              style={[

                styles.optionButton,

                selectedEmergency === item &&
                styles.activeButton

              ]}

              onPress={()=>
                setSelectedEmergency(item)
              }

            >

              <Text style={styles.buttonText}>
                {item}
              </Text>

            </TouchableOpacity>

          ))

        }

      </View>

      {/* SEND BUTTON */}

      <TouchableOpacity

        style={styles.sosButton}

        onPress={sendSOS}

      >

        <Text style={styles.sosText}>

          {

            loading
            ?

            "Sending..."

            :

            "SEND SOS"

          }

        </Text>

      </TouchableOpacity>

    </View>

  );

}

const styles = StyleSheet.create({

  container:{
    flex:1,
    justifyContent:"center",
    alignItems:"center",
    backgroundColor:"#f5f5f5",
    padding:20
  },

  heading:{
    fontSize:32,
    fontWeight:"bold",
    marginBottom:10,
    color:"#dc2626"
  },

  subHeading:{
    fontSize:18,
    marginBottom:20
  },

  buttonContainer:{
    width:"100%"
  },

  optionButton:{
    backgroundColor:"#2563eb",
    padding:15,
    borderRadius:10,
    marginBottom:10
  },

  activeButton:{
    backgroundColor:"#dc2626"
  },

  buttonText:{
    color:"white",
    textAlign:"center",
    fontSize:18,
    fontWeight:"bold"
  },

  sosButton:{
    marginTop:30,
    backgroundColor:"#111827",
    paddingVertical:18,
    paddingHorizontal:40,
    borderRadius:15
  },

  sosText:{
    color:"white",
    fontSize:22,
    fontWeight:"bold"
  }

});