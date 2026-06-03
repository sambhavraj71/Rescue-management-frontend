import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

const EMERGENCY_TYPES = ["Accident", "Flood", "Fire", "Earthquake", "Medical"];
const IMGBB_API_KEY = process.env.EXPO_PUBLIC_IMGBB_API_KEY || "9eabe4c080b1e55b9a1165e2f1a8aa9e";

export default function SOSScreen({ route, navigation }) {
  const [userId, setUserId] = useState(route?.params?.userId || null);

  useEffect(() => {
    if (!userId) {
      AsyncStorage.getItem("userId").then((id) => { if (id) setUserId(id); });
    }
  }, []);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState("Accident");
  const [notes, setNotes] = useState("");
  const [imageUri, setImageUri] = useState("");

  const canSend = useMemo(() => !!userId && !loading && !uploading, [userId, loading, uploading]);

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Please allow photo access to upload emergency image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Image Error", "Could not pick image");
    }
  };

  const uploadImageToImgbb = async (uri) => {
    if (!uri) return "";
    setUploading(true);
    try {
      let base64String = "";

      if (uri.startsWith("data:")) {
        // already data URL
        base64String = uri.split(",")[1];
      } else if (uri.startsWith("blob:")) {
        // web blob URL — convert to base64
        const response = await fetch(uri);
        const blob = await response.blob();
        base64String = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // mobile file URI
        const fileName = uri.split("/").pop() || `sos_${Date.now()}.jpg`;
        const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
        const body = new FormData();
        body.append("image", { uri, name: fileName, type: ext === "png" ? "image/png" : "image/jpeg" });
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error?.message || "Upload failed");
        return data?.data?.url || "";
      }

      // send base64 to imgbb
      const body = new FormData();
      body.append("image", base64String);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error?.message || "Upload failed");
      return data?.data?.url || "";
    } finally {
      setUploading(false);
    }
  };

  const sendSOS = async ({ voiceEmergency = false } = {}) => {
    if (!userId) {
      Alert.alert("User Error", "Please login again and retry");
      navigation.replace("Login");
      return;
    }

    try {
      setLoading(true);

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required for rescue operations.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      const uploadedImageUrl = imageUri ? await uploadImageToImgbb(imageUri) : "";

      const response = await API.post("/sos/create", {
        userId,
        emergencyType: voiceEmergency ? "Voice Emergency" : selectedEmergency,
        latitude,
        longitude,
        notes,
        imageUrl: uploadedImageUrl,
        voiceEmergency,
      });

      Alert.alert("SOS Sent", "Rescue team has been notified successfully.");
      setNotes("");
      setImageUri("");
      navigation.navigate("Main", { screen: "Alerts", params: { userId } });
    } catch (error) {
      console.log(error);
      Alert.alert("Failed To Send SOS", error?.response?.data?.message || error?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Emergency SOS</Text>
        <Text style={styles.subHeading}>Choose emergency type and send live details</Text>

        <Text style={styles.sectionTitle}>Emergency Type</Text>
        <View style={styles.chipWrap}>
          {EMERGENCY_TYPES.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, selectedEmergency === item && styles.chipActive]}
              onPress={() => setSelectedEmergency(item)}
            >
              <Text style={[styles.chipText, selectedEmergency === item && styles.chipTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Emergency Note</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Short note for rescue team (optional)"
          placeholderTextColor="#94a3b8"
          multiline
          style={styles.notesInput}
        />

        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} disabled={uploading || loading}>
            <Ionicons name="image-outline" size={18} color="#fff" />
            <Text style={styles.uploadText}>{imageUri ? "Change Image" : "Upload Emergency Image"}</Text>
          </TouchableOpacity>

          {(uploading || loading) && <ActivityIndicator color="#ef4444" />}
        </View>

        {imageUri ? (
          <View style={styles.previewCard}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
            <TouchableOpacity onPress={() => setImageUri("")}>
              <Text style={styles.removeText}>Remove Image</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.sosButton, !canSend && styles.disabled]} onPress={() => sendSOS()} disabled={!canSend}>
          <Ionicons name="warning" size={22} color="#fff" />
          <Text style={styles.sosText}>{loading ? "Sending..." : "Send SOS"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.voiceButton, !canSend && styles.disabled]}
          onPress={() => sendSOS({ voiceEmergency: true })}
          disabled={!canSend}
        >
          <Ionicons name="mic" size={20} color="#fca5a5" />
          <Text style={styles.voiceText}>Voice Emergency (Quick Send)</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 30,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 6,
  },
  subHeading: {
    color: "#94a3b8",
    marginBottom: 20,
  },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: "#1e293b",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  chipActive: {
    backgroundColor: "#7f1d1d",
    borderColor: "#ef4444",
  },
  chipText: {
    color: "#cbd5e1",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fecaca",
  },
  notesInput: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 14,
    color: "#e2e8f0",
    minHeight: 90,
    padding: 12,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  uploadBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
  },
  uploadText: {
    color: "#fff",
    fontWeight: "700",
  },
  previewCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  previewImage: {
    width: "100%",
    height: 170,
    borderRadius: 10,
    marginBottom: 8,
  },
  removeText: {
    color: "#fda4af",
    textAlign: "right",
    fontWeight: "700",
  },
  sosButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
  },
  sosText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
  },
  voiceButton: {
    marginTop: 12,
    backgroundColor: "#1f2937",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  voiceText: {
    color: "#fecaca",
    fontWeight: "700",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.65,
  },
});
