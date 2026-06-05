import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");
    if (!name || !email || !password) { setError("Please fill all fields"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    try {
      setLoading(true);
      await API.post("/auth/register", { name, email, password });
      navigation.navigate("Login");
    } catch (e) {
      setError(e.response?.data?.message || "Registration failed. Try again.");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Back Button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoSection}>
            <LinearGradient colors={["#dc2626", "#991b1b"]} style={styles.logoCircle}>
              <Ionicons name="warning" size={34} color="#fff" />
            </LinearGradient>
            <Text style={styles.appName}>RescueApp</Text>
            <Text style={styles.appTagline}>Emergency Response System</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSub}>Join the rescue network today</Text>

            {/* Name */}
            <View style={styles.fieldLabel}>
              <Ionicons name="person-outline" size={13} color="#64748b" />
              <Text style={styles.labelText}>Full Name</Text>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#475569"
                value={name}
                onChangeText={(t) => { setName(t); setError(""); }}
                autoCapitalize="words"
              />
            </View>

            {/* Email */}
            <View style={styles.fieldLabel}>
              <Ionicons name="mail-outline" size={13} color="#64748b" />
              <Text style={styles.labelText}>Email Address</Text>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#475569"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(""); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Password */}
            <View style={styles.fieldLabel}>
              <Ionicons name="lock-closed-outline" size={13} color="#64748b" />
              <Text style={styles.labelText}>Password</Text>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min. 6 characters"
                placeholderTextColor="#475569"
                value={password}
                onChangeText={(t) => { setPassword(t); setError(""); }}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Password strength */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      password.length >= i * 3 && {
                        backgroundColor: password.length >= 12 ? "#22c55e" : password.length >= 8 ? "#f59e0b" : "#ef4444",
                      },
                    ]}
                  />
                ))}
                <Text style={styles.strengthText}>
                  {password.length >= 12 ? "Strong" : password.length >= 8 ? "Medium" : "Weak"}
                </Text>
              </View>
            )}

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={14} color="#fca5a5" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Register Button */}
            <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85} style={{ marginTop: 8 }}>
              <LinearGradient
                colors={loading ? ["#374151", "#1f2937"] : ["#dc2626", "#991b1b"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.registerBtn}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="person-add-outline" size={20} color="#fff" />
                      <Text style={styles.registerBtnText}>Create Account</Text>
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

            {/* Login */}
            <TouchableOpacity style={styles.loginRow} onPress={() => navigation.navigate("Login")}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <Text style={styles.loginLink}> Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <View style={styles.terms}>
            <Ionicons name="shield-checkmark-outline" size={13} color="#334155" />
            <Text style={styles.termsText}>By registering, you agree to our emergency response terms</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0f1e" },
  scroll: { flexGrow: 1, padding: 24, paddingBottom: 40 },

  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155",
    justifyContent: "center", alignItems: "center", marginBottom: 24,
  },

  logoSection: { alignItems: "center", marginBottom: 28 },
  logoCircle: {
    width: 70, height: 70, borderRadius: 35,
    justifyContent: "center", alignItems: "center", marginBottom: 12,
    shadowColor: "#ef4444", shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  appName: { fontSize: 24, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  appTagline: { fontSize: 12, color: "#64748b", marginTop: 4 },

  card: { backgroundColor: "#111827", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#1e293b" },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  cardSub: { fontSize: 13, color: "#64748b", marginBottom: 20 },

  fieldLabel: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 },
  labelText: { fontSize: 11, color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1e293b", borderRadius: 14,
    borderWidth: 1, borderColor: "#334155",
    paddingHorizontal: 14, marginBottom: 16,
  },
  input: { flex: 1, color: "#e2e8f0", fontSize: 15, paddingVertical: 14 },
  eyeBtn: { paddingLeft: 8 },

  strengthRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -8, marginBottom: 14 },
  strengthBar: { flex: 1, height: 3, backgroundColor: "#1e293b", borderRadius: 2 },
  strengthText: { fontSize: 10, color: "#64748b", fontWeight: "600", width: 45 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#450a0a", borderRadius: 10, padding: 10, marginBottom: 8,
  },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },

  registerBtn: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
    shadowColor: "#ef4444", shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  registerBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#1e293b" },
  dividerText: { color: "#334155", fontSize: 12, fontWeight: "600" },

  loginRow: { flexDirection: "row", justifyContent: "center" },
  loginText: { color: "#64748b", fontSize: 14 },
  loginLink: { color: "#ef4444", fontSize: 14, fontWeight: "700" },

  terms: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 20 },
  termsText: { fontSize: 11, color: "#334155", textAlign: "center", flex: 1 },
});
