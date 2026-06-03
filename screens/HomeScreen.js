import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function HomeScreen({ navigation, route }) {
  const [userId, setUserId] = useState(route?.params?.userId || null);
  const [userName, setUserName] = useState(route?.params?.userName || "User");
  const [role, setRole] = useState(route?.params?.role || "user");

  useEffect(() => {
    AsyncStorage.multiGet(["userId", "userName", "role"]).then((vals) => {
      if (!userId && vals[0][1]) setUserId(vals[0][1]);
      if (vals[1][1]) setUserName(vals[1][1]);
      if (vals[2][1]) setRole(vals[2][1]);
    });
  }, []);

  const logout = async () => {
    await AsyncStorage.multiRemove(["token", "userId", "userName", "role"]);
    navigation.replace("Login");
  };

  const isRescue = role === "rescue" || role === "admin";

  if (isRescue) {
    return <RescueHome navigation={navigation} userName={userName} role={role} logout={logout} />;
  }

  return <UserHome navigation={navigation} userId={userId} userName={userName} logout={logout} />;
}

// ── User Home ─────────────────────────────────────────────────
function UserHome({ navigation, userId, userName, logout }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerApp}>🚨 RescueApp</Text>
          <Text style={styles.headerWelcome}>Welcome, {userName}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-circle" size={42} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <TouchableOpacity
          style={styles.sosBigBtn}
          onPress={() => navigation.navigate("SOS", { userId })}
        >
          <Ionicons name="warning" size={32} color="#fff" />
          <Text style={styles.sosBigText}>SEND SOS ALERT</Text>
          <Text style={styles.sosBigSub}>Tap to send emergency request</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          <ActionCard icon="map" color="#38bdf8" label="View Map" onPress={() => navigation.navigate("Map")} />
          <ActionCard icon="notifications" color="#facc15" label="My Alerts" onPress={() => navigation.navigate("Alerts")} />
          <ActionCard icon="radio" color="#ef4444" label="SOS Panel" onPress={() => navigation.navigate("SOS", { userId })} />
          <ActionCard icon="log-out" color="#94a3b8" label="Logout" onPress={logout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Rescue Home ───────────────────────────────────────────────
function RescueHome({ navigation, userName, role, logout }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerApp}>🚨 RescueApp</Text>
          <Text style={styles.headerWelcome}>🛡 {userName}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
          <Ionicons name="person-circle" size={42} color="#22c55e" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.rescueBanner}>
          <Ionicons name="shield-checkmark" size={36} color="#22c55e" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rescueBannerTitle}>Rescue Team Portal</Text>
            <Text style={styles.rescueBannerSub}>You are logged in as a {role} member</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Rescue Operations</Text>
        <View style={styles.grid}>
          <ActionCard
            icon="notifications"
            color="#f59e0b"
            label="Pending Requests"
            onPress={() => navigation.navigate("Rescue", { screen: "requests" })}
          />
          <ActionCard
            icon="shield-checkmark"
            color="#22c55e"
            label="My Cases"
            onPress={() => navigation.navigate("Rescue", { screen: "mycases" })}
          />
          <ActionCard
            icon="map"
            color="#38bdf8"
            label="View Map"
            onPress={() => navigation.navigate("Map")}
          />
          <ActionCard
            icon="log-out"
            color="#94a3b8"
            label="Logout"
            onPress={logout}
          />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color="#38bdf8" />
          <Text style={styles.infoText}>
            Go to the <Text style={{ color: "#22c55e", fontWeight: "700" }}>Rescue</Text> tab in bottom bar to manage SOS requests and track victims.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ icon, color, label, onPress }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 15,
    backgroundColor: "#1e293b", borderBottomWidth: 1, borderBottomColor: "#334155",
  },
  headerApp: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  headerWelcome: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  body: { padding: 20, paddingBottom: 40 },

  // User SOS button
  sosBigBtn: {
    backgroundColor: "#ef4444", borderRadius: 18, padding: 28,
    alignItems: "center", gap: 8, marginBottom: 28,
    shadowColor: "#ef4444", shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  sosBigText: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  sosBigSub: { color: "#fecaca", fontSize: 13 },

  // Rescue banner
  rescueBanner: {
    backgroundColor: "#14532d", borderRadius: 14, padding: 18,
    flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24,
    borderWidth: 1, borderColor: "#16a34a",
  },
  rescueBannerTitle: { color: "#bbf7d0", fontSize: 16, fontWeight: "800" },
  rescueBannerSub: { color: "#86efac", fontSize: 12, marginTop: 3, textTransform: "capitalize" },

  infoBox: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: "#1e293b", borderRadius: 12, padding: 14, marginTop: 10,
  },
  infoText: { flex: 1, color: "#94a3b8", fontSize: 13, lineHeight: 20 },

  sectionTitle: {
    color: "#94a3b8", fontSize: 12, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    width: "47%", backgroundColor: "#1e293b", borderRadius: 14,
    padding: 20, alignItems: "center", gap: 10,
  },
  actionText: { color: "#e2e8f0", fontSize: 14, fontWeight: "600" },
});
