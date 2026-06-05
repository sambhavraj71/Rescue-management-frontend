import React, { useMemo, useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  TextInput, ActivityIndicator, Image, ScrollView, Animated, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

const IMGBB_API_KEY = process.env.EXPO_PUBLIC_IMGBB_API_KEY || "9eabe4c080b1e55b9a1165e2f1a8aa9e";

const EMERGENCY_TYPES = [
  { type: "Accident",   icon: "car",             color: "#f97316", bg: "#431407" },
  { type: "Flood",      icon: "water",            color: "#38bdf8", bg: "#082f49" },
  { type: "Fire",       icon: "flame",            color: "#ef4444", bg: "#450a0a" },
  { type: "Earthquake", icon: "earth",            color: "#f59e0b", bg: "#431407" },
  { type: "Medical",    icon: "medkit",           color: "#22c55e", bg: "#052e16" },
];

export default function SOSScreen({ route, navigation }) {
  const [userId, setUserId] = useState(route?.params?.userId || null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState("Accident");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState("");
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (!userId) {
      AsyncStorage.getItem("userId").then((id) => { if (id) setUserId(id); });
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const canSend = useMemo(() => !!userId && !loading && !uploading, [userId, loading, uploading]);
  const selected = EMERGENCY_TYPES.find((e) => e.type === selectedEmergency);

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") { Alert.alert("Permission Denied", "Allow photo access."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      if (!result.canceled && result.assets?.length) setImageUri(result.assets[0].uri);
    } catch { }
  };

  const uploadImageToImgbb = async (uri) => {
    if (!uri) return "";
    setUploading(true);
    try {
      let base64String = "";
      if (uri.startsWith("data:")) {
        base64String = uri.split(",")[1];
      } else if (uri.startsWith("blob:")) {
        const response = await fetch(uri);
        const blob = await response.blob();
        base64String = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const fileName = uri.split("/").pop() || `sos_${Date.now()}.jpg`;
        const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
        const body = new FormData();
        body.append("image", { uri, name: fileName, type: ext === "png" ? "image/png" : "image/jpeg" });
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error("Upload failed");
        return data?.data?.url || "";
      }
      const body = new FormData();
      body.append("image", base64String);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error("Upload failed");
      return data?.data?.url || "";
    } finally { setUploading(false); }
  };

  const getLocation = () => new Promise((resolve, reject) => {
    if (Platform.OS === "web") {
      if (!navigator?.geolocation) { reject(new Error("Geolocation not supported")); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(resolve).catch(reject);
    }
  });

  const sendSOS = async ({ voiceEmergency = false } = {}) => {
    if (!userId) { navigation.replace("Login"); return; }
    try {
      setLoading(true);
      if (Platform.OS !== "web") {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== "granted") { setLoading(false); return; }
      }
      const loc = await getLocation();
      const uploadedImageUrl = imageUri ? await uploadImageToImgbb(imageUri) : "";
      await API.post("/sos/create", {
        userId,
        emergencyType: voiceEmergency ? "Voice Emergency" : selectedEmergency,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        notes,
        imageUrl: uploadedImageUrl,
        voiceEmergency,
      });
      setNotes(""); setImageUri("");
      navigation.navigate("Main", { screen: "Alerts", params: { userId } });
    } catch (error) {
      console.log(error);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={["#1a0000", "#450a0a"]} style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.headerBadge}>
              <View style={styles.headerBadgeDot} />
              <Text style={styles.headerBadgeText}>EMERGENCY PANEL</Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>Send SOS Alert</Text>
          <Text style={styles.headerSub}>Your live location will be shared with rescue teams instantly</Text>
        </LinearGradient>

        {/* Emergency Type */}
        <Text style={styles.sectionLabel}>Select Emergency Type</Text>
        <View style={styles.typeGrid}>
          {EMERGENCY_TYPES.map((item) => {
            const isActive = selectedEmergency === item.type;
            return (
              <TouchableOpacity
                key={item.type}
                style={[styles.typeCard, isActive && { borderColor: item.color, borderWidth: 2 }]}
                onPress={() => setSelectedEmergency(item.type)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isActive ? [item.bg, item.bg + "cc"] : ["#1e293b", "#111827"]}
                  style={styles.typeCardGrad}
                >
                  <View style={[styles.typeIconBox, { backgroundColor: item.color + (isActive ? "33" : "18") }]}>
                    <Ionicons name={item.icon} size={22} color={item.color} />
                  </View>
                  <Text style={[styles.typeLabel, isActive && { color: item.color }]}>{item.type}</Text>
                  {isActive && (
                    <View style={[styles.typeCheck, { backgroundColor: item.color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Notes */}
        <Text style={styles.sectionLabel}>Emergency Note</Text>
        <View style={styles.notesWrap}>
          <Ionicons name="create-outline" size={16} color="#64748b" style={styles.notesIcon} />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe your situation (optional)"
            placeholderTextColor="#475569"
            multiline
            style={styles.notesInput}
          />
        </View>

        {/* Image Upload */}
        <Text style={styles.sectionLabel}>Attach Photo</Text>
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={pickImage}
          disabled={uploading || loading}
          activeOpacity={0.8}
        >
          <LinearGradient colors={["#1e3a5f", "#0c4a6e"]} style={styles.uploadBtnInner}>
            <Ionicons name={imageUri ? "checkmark-circle" : "camera"} size={20} color={imageUri ? "#22c55e" : "#38bdf8"} />
            <Text style={[styles.uploadText, imageUri && { color: "#22c55e" }]}>
              {uploading ? "Uploading..." : imageUri ? "Image attached ✓" : "Attach Emergency Photo"}
            </Text>
            {uploading && <ActivityIndicator size="small" color="#38bdf8" />}
          </LinearGradient>
        </TouchableOpacity>

        {imageUri ? (
          <View style={styles.previewCard}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <TouchableOpacity style={styles.removeBtn} onPress={() => setImageUri("")}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Main SOS Button */}
        <Animated.View style={[{ transform: [{ scale: pulseAnim }] }, styles.sosBtnWrap]}>
          <TouchableOpacity disabled={!canSend} onPress={() => sendSOS()} activeOpacity={0.85}>
            <LinearGradient
              colors={canSend ? ["#dc2626", "#991b1b"] : ["#374151", "#1f2937"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.sosBtn}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <>
                  <View style={styles.sosIconRing}>
                    <Ionicons name="warning" size={32} color="#fff" />
                  </View>
                  <Text style={styles.sosBtnTitle}>SEND SOS NOW</Text>
                  <Text style={styles.sosBtnSub}>
                    {selected ? `${selected.type} Emergency` : "Emergency"} · Live Location
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Voice Emergency */}
        <TouchableOpacity
          style={[styles.voiceBtn, !canSend && styles.disabled]}
          onPress={() => sendSOS({ voiceEmergency: true })}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <View style={styles.voiceBtnInner}>
            <View style={styles.voiceIconBox}>
              <Ionicons name="mic" size={20} color="#a78bfa" />
            </View>
            <View>
              <Text style={styles.voiceBtnTitle}>Quick Voice SOS</Text>
              <Text style={styles.voiceBtnSub}>Send instantly without selecting type</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#64748b" />
          </View>
        </TouchableOpacity>

        {/* Safety Note */}
        <View style={styles.safetyNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#22c55e" />
          <Text style={styles.safetyText}>Your location is only shared with assigned rescue teams</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0f1e" },
  container: { paddingBottom: 40 },

  // Header
  headerCard: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28 },
  headerTop: { marginBottom: 12 },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ef444422", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start",
  },
  headerBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444" },
  headerBadgeText: { fontSize: 10, color: "#fca5a5", fontWeight: "800", letterSpacing: 1 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 6 },
  headerSub: { fontSize: 13, color: "#fca5a580", lineHeight: 18 },

  // Section Label
  sectionLabel: {
    fontSize: 11, color: "#64748b", fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1.5,
    marginBottom: 10, marginTop: 20, paddingHorizontal: 20,
  },

  // Type Grid
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20 },
  typeCard: { width: "30%", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#1e293b" },
  typeCardGrad: { padding: 12, alignItems: "center", gap: 6, borderRadius: 14 },
  typeIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  typeLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "700", textAlign: "center" },
  typeCheck: {
    position: "absolute", top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    justifyContent: "center", alignItems: "center",
  },

  // Notes
  notesWrap: {
    marginHorizontal: 20, backgroundColor: "#1e293b",
    borderRadius: 14, borderWidth: 1, borderColor: "#334155",
    padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8,
  },
  notesIcon: { marginTop: 2 },
  notesInput: {
    flex: 1, color: "#e2e8f0", fontSize: 14,
    minHeight: 80, textAlignVertical: "top", lineHeight: 20,
  },

  // Upload
  uploadBtn: { marginHorizontal: 20, borderRadius: 14, overflow: "hidden" },
  uploadBtnInner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderWidth: 1, borderColor: "#0369a144", borderRadius: 14,
  },
  uploadText: { flex: 1, color: "#38bdf8", fontWeight: "700", fontSize: 14 },

  // Preview
  previewCard: {
    marginHorizontal: 20, marginTop: 10,
    backgroundColor: "#111827", borderRadius: 14,
    padding: 10, borderWidth: 1, borderColor: "#1f2937",
  },
  previewImage: { width: "100%", height: 160, borderRadius: 10, marginBottom: 8 },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" },
  removeText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

  // SOS Button
  sosBtnWrap: { marginHorizontal: 20, marginTop: 24 },
  sosBtn: {
    borderRadius: 20, padding: 24, alignItems: "center", gap: 10,
    shadowColor: "#ef4444", shadowOpacity: 0.6, shadowRadius: 20, elevation: 14,
  },
  sosIconRing: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: "#ffffff22", justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#ffffff33",
  },
  sosBtnTitle: { fontSize: 20, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  sosBtnSub: { fontSize: 13, color: "#fca5a5" },

  // Voice Button
  voiceBtn: { marginHorizontal: 20, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: "#2d1b69" },
  voiceBtnInner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1a1a2e", borderRadius: 16, padding: 14,
  },
  voiceIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#a78bfa22", justifyContent: "center", alignItems: "center",
  },
  voiceBtnTitle: { fontSize: 14, fontWeight: "700", color: "#e2e8f0" },
  voiceBtnSub: { fontSize: 11, color: "#64748b", marginTop: 2 },

  // Safety Note
  safetyNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 20, marginTop: 16,
    justifyContent: "center",
  },
  safetyText: { fontSize: 11, color: "#64748b" },

  disabled: { opacity: 0.5 },
});
