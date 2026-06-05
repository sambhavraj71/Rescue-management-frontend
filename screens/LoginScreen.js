import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Please enter email and password"); return; }
    try {
      setLoading(true);
      const res = await API.post("/auth/login", { email, password });
      const uid = res.data.user._id;
      await AsyncStorage.multiSet([
        ["token", res.data.token || ""],
        ["userId", uid],
        ["userName", res.data.user.name || "User"],
        ["role", res.data.user.role || "user"],
      ]);
      navigation.replace("Main", {
        userId: uid,
        userName: res.data.user.name,
        role: res.data.user.role,
      });
    } catch (e) {
      setError(e.response?.data?.message || "Login failed. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Logo Section */}
          <View style={styles.logoSection}>
            <LinearGradient colors={["#dc2626", "#991b1b"]} style={styles.logoCircle}>
              <Ionicons name="warning" size={38} color="#fff" />
            </LinearGradient>
            <Text style={styles.appName}>RescueApp</Text>
            <Text style={styles.appTagline}>Emergency Response System</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSub}>Sign in to your account</Text>

            {/* Email */}
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <Ionicons name="mail-outline" size={18} color="#64748b" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#475569"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(""); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon}>
                <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#475569"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#fca5a5" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Login Button */}
            <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={{ marginTop: 8 }}>
              <LinearGradient
                colors={loading ? ["#374151", "#1f2937"] : ["#dc2626", "#991b1b"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.loginBtn}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="log-in-outline" size={20} color="#fff" />
                      <Text style={styles.loginBtnText}>Sign In</Text>
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register */}
            <TouchableOpacity style={styles.registerRow} onPress={() => navigation.navigate("Register")}>
              <Text style={styles.registerText}>Don't have an account?</Text>
              <Text style={styles.registerLink}> Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#334155" />
            <Text style={styles.footerText}>Your data is encrypted and secure</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0f1e" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24, paddingBottom: 40 },

  logoSection: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: "center", alignItems: "center",
    marginBottom: 14,
    shadowColor: "#ef4444", shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  appName: { fontSize: 28, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  appTagline: { fontSize: 13, color: "#64748b", marginTop: 4 },

  card: {
    backgroundColor: "#111827", borderRadius: 24,
    padding: 24, borderWidth: 1, borderColor: "#1e293b",
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  cardSub: { fontSize: 13, color: "#64748b", marginBottom: 24 },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1e293b", borderRadius: 14,
    borderWidth: 1, borderColor: "#334155",
    marginBottom: 14, paddingHorizontal: 4,
  },
  inputIcon: { paddingHorizontal: 12 },
  input: { flex: 1, color: "#e2e8f0", fontSize: 15, paddingVertical: 14 },
  eyeBtn: { paddingHorizontal: 12 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#450a0a", borderRadius: 10,
    padding: 10, marginBottom: 8,
  },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },

  loginBtn: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
    shadowColor: "#ef4444", shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1e293b" },
  dividerText: { color: "#334155", fontSize: 12, fontWeight: "600" },

  registerRow: { flexDirection: "row", justifyContent: "center" },
  registerText: { color: "#64748b", fontSize: 14 },
  registerLink: { color: "#ef4444", fontSize: 14, fontWeight: "700" },

  footer: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 11, color: "#334155" },
});
