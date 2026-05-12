import React, { useState } from "react";

import {
 View,
 Text,
 TextInput,
 Button,
 Alert
}
from "react-native";

import API from "../services/api";

export default function RegisterScreen({ navigation }) {

 const [name,setName] = useState("");
 const [email,setEmail] = useState("");
 const [password,setPassword] = useState("");

 const handleRegister = async () => {

   try {

     const response =
     await API.post(
       "/auth/register",
       {
         name,
         email,
         password
       }
     );

     Alert.alert("Registered");

     navigation.navigate("Login");

   } catch (error) {

     console.log(error);

     Alert.alert("Error");

   }

 };

 return (

   <View style={{
     flex:1,
     justifyContent:"center",
     padding:20
   }}>

     <Text>Name</Text>

     <TextInput
       placeholder="Enter Name"
       value={name}
       onChangeText={setName}
       style={{
         borderWidth:1,
         marginBottom:10,
         padding:10
       }}
     />

     <Text>Email</Text>

     <TextInput
       placeholder="Enter Email"
       value={email}
       onChangeText={setEmail}
       style={{
         borderWidth:1,
         marginBottom:10,
         padding:10
       }}
     />

     <Text>Password</Text>

     <TextInput
       placeholder="Enter Password"
       secureTextEntry
       value={password}
       onChangeText={setPassword}
       style={{
         borderWidth:1,
         marginBottom:20,
         padding:10
       }}
     />

     <Button
       title="Register"
       onPress={handleRegister}
     />

   </View>

 );

}