import React, { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet
} from "react-native";
import API from "../services/api";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    try {
      const response = await API.post("/auth/login", { email, password });

      await AsyncStorage.multiSet([
        ["token", response.data.token || ""],
        ["userId", response.data.user._id],
        ["userName", response.data.user.name || "User"],
        ["role", response.data.user.role || "user"],
      ]);

      navigation.replace("Main", {
        userId: response.data.user._id,
        userName: response.data.user.name,
        role: response.data.user.role,
      });
    } catch (error) {
      Alert.alert("Login Failed", error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rescue App</Text>
      <Text style={styles.subtitle}>Login to continue</Text>

      <TextInput
        placeholder="Enter Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        placeholder="Enter Password"
        placeholderTextColor="#888"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={styles.registerText}>
          Don't have an account?
          <Text style={styles.registerHighlight}> Register</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 25, backgroundColor: "#f5f7fa" },
  title: { fontSize: 34, fontWeight: "bold", color: "#e53935", textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#555", textAlign: "center", marginBottom: 40 },
  input: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd",
    borderRadius: 12, padding: 15, marginBottom: 18, fontSize: 16,
  },
  loginButton: { backgroundColor: "#e53935", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
  loginText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  registerText: { textAlign: "center", marginTop: 25, fontSize: 15, color: "#555" },
  registerHighlight: { color: "#e53935", fontWeight: "bold" },
});
