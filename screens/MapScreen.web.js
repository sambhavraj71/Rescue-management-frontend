import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚨 RescueApp</Text>
        <Ionicons name="person-circle" size={42} color="#ef4444" />
      </View>
      <View style={styles.fallback}>
        <Ionicons name="map" size={60} color="#38bdf8" />
        <Text style={styles.title}>Live Rescue Map</Text>
        <Text style={styles.sub}>Map is available on mobile app (Android/iOS)</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#1e293b",
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  fallback: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  title: { fontSize: 22, fontWeight: "bold", color: "#e2e8f0" },
  sub: { fontSize: 14, color: "#94a3b8", textAlign: "center", paddingHorizontal: 40 },
});
