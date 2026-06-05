import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

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
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0 });
  const pulseAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (userId) {
      API.get(`/sos/user/${userId}`).then((res) => {
        const data = res.data || [];
        setStats({
          total: data.length,
          active: data.filter((s) => s.status !== "completed").length,
          completed: data.filter((s) => s.status === "completed").length,
        });
      }).catch(() => {});
    }
    // Pulse animation for SOS button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [userId]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={["#0f172a", "#1e1b4b"]} style={styles.headerGrad}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>{getGreeting()} 👋</Text>
              <Text style={styles.userName}>{userName}</Text>
              <View style={styles.safeChip}>
                <View style={styles.safeChipDot} />
                <Text style={styles.safeChipText}>You are protected</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.avatarBtn}>
              <LinearGradient colors={["#ef4444", "#dc2626"]} style={styles.avatar}>
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          {[
            { label: "Total SOS", value: stats.total, color: "#818cf8", icon: "radio" },
            { label: "Active", value: stats.active, color: "#f59e0b", icon: "pulse" },
            { label: "Resolved", value: stats.completed, color: "#22c55e", icon: "checkmark-circle" },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: s.color + "22" }]}>
                <Ionicons name={s.icon} size={16} color={s.color} />
              </View>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* SOS Button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 24 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("SOS", { userId })}
          >
            <LinearGradient
              colors={["#dc2626", "#991b1b"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.sosBtn}
            >
              <View style={styles.sosBtnInner}>
                <View style={styles.sosIconCircle}>
                  <Ionicons name="warning" size={36} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sosBtnTitle}>SEND SOS ALERT</Text>
                  <Text style={styles.sosBtnSub}>Tap to send emergency request instantly</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fca5a5" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: "map", label: "Live Map", sub: "Track rescue team", colors: ["#1e3a5f", "#0c4a6e"], iconColor: "#38bdf8", onPress: () => navigation.navigate("Map") },
            { icon: "notifications", label: "My Alerts", sub: "View SOS history", colors: ["#3b1a00", "#78350f"], iconColor: "#f59e0b", onPress: () => navigation.navigate("Alerts") },
            { icon: "radio", label: "SOS Panel", sub: "Emergency send", colors: ["#3f0000", "#7f1d1d"], iconColor: "#ef4444", onPress: () => navigation.navigate("SOS", { userId }) },
            { icon: "person", label: "Profile", sub: "Your account", colors: ["#1a1a2e", "#2d1b69"], iconColor: "#a78bfa", onPress: () => navigation.navigate("Profile") },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.actionCard} onPress={item.onPress} activeOpacity={0.8}>
              <LinearGradient colors={item.colors} style={styles.actionCardGrad}>
                <View style={[styles.actionIconBox, { backgroundColor: item.iconColor + "22" }]}>
                  <Ionicons name={item.icon} size={24} color={item.iconColor} />
                </View>
                <Text style={styles.actionLabel}>{item.label}</Text>
                <Text style={styles.actionSub}>{item.sub}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Emergency Info Card */}
        <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.infoCard}>
          <View style={styles.infoCardRow}>
            <LinearGradient colors={["#1d4ed8", "#1e40af"]} style={styles.infoIconBox}>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoCardTitle}>Emergency Helpline</Text>
              <Text style={styles.infoCardSub}>Available 24/7 — Rescue teams on standby</Text>
            </View>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>LIVE</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#64748b" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Rescue Home ───────────────────────────────────────────────
function RescueHome({ navigation, userName, role, logout }) {
  const [stats, setStats] = useState({ pending: 0, active: 0, completed: 0 });

  useEffect(() => {
    API.get("/rescue/pending").then((res) => {
      setStats((p) => ({ ...p, pending: (res.data || []).length }));
    }).catch(() => {});
    API.get(`/rescue/my-active/${encodeURIComponent(userName)}`).then((res) => {
      const data = res.data || [];
      setStats((p) => ({
        ...p,
        active: data.filter((s) => s.status !== "completed").length,
        completed: data.filter((s) => s.status === "completed").length,
      }));
    }).catch(() => {});
  }, [userName]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={["#0f2d1a", "#14532d"]} style={styles.headerGrad}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Rescue Team 🛡</Text>
              <Text style={styles.userName}>{userName}</Text>
              <View style={[styles.safeChip, { backgroundColor: "#15803d33" }]}>
                <View style={[styles.safeChipDot, { backgroundColor: "#22c55e" }]} />
                <Text style={[styles.safeChipText, { color: "#86efac" }]}>On Duty</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.avatarBtn}>
              <LinearGradient colors={["#22c55e", "#16a34a"]} style={styles.avatar}>
                <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "Pending", value: stats.pending, color: "#f59e0b", icon: "alert-circle" },
            { label: "Active", value: stats.active, color: "#22c55e", icon: "pulse" },
            { label: "Done", value: stats.completed, color: "#818cf8", icon: "checkmark-done" },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: s.color + "22" }]}>
                <Ionicons name={s.icon} size={16} color={s.color} />
              </View>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Rescue Banner */}
        <LinearGradient colors={["#14532d", "#166534"]} style={styles.rescueBanner}>
          <View style={styles.rescueBannerInner}>
            <View style={styles.rescueBannerIcon}>
              <Ionicons name="shield-checkmark" size={28} color="#22c55e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rescueBannerTitle}>Rescue Command Active</Text>
              <Text style={styles.rescueBannerSub}>Logged in as {role} · Ready for deployment</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Actions */}
        <Text style={styles.sectionTitle}>Operations</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: "notifications", label: "Pending SOS", sub: `${stats.pending} awaiting`, colors: ["#3b1a00", "#78350f"], iconColor: "#f59e0b", onPress: () => navigation.navigate("Rescue") },
            { icon: "shield-checkmark", label: "My Cases", sub: `${stats.active} active`, colors: ["#0a2e16", "#14532d"], iconColor: "#22c55e", onPress: () => navigation.navigate("Rescue") },
            { icon: "map", label: "Operations Map", sub: "Live tracking", colors: ["#1e3a5f", "#0c4a6e"], iconColor: "#38bdf8", onPress: () => navigation.navigate("Map") },
            { icon: "person", label: "Profile", sub: "Your account", colors: ["#1a1a2e", "#2d1b69"], iconColor: "#a78bfa", onPress: () => navigation.navigate("Profile") },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.actionCard} onPress={item.onPress} activeOpacity={0.8}>
              <LinearGradient colors={item.colors} style={styles.actionCardGrad}>
                <View style={[styles.actionIconBox, { backgroundColor: item.iconColor + "22" }]}>
                  <Ionicons name={item.icon} size={24} color={item.iconColor} />
                </View>
                <Text style={styles.actionLabel}>{item.label}</Text>
                <Text style={styles.actionSub}>{item.sub}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tip */}
        <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.infoCard}>
          <View style={styles.infoCardRow}>
            <LinearGradient colors={["#0369a1", "#0284c7"]} style={styles.infoIconBox}>
              <Ionicons name="information-circle" size={20} color="#fff" />
            </LinearGradient>
            <Text style={[styles.infoCardSub, { flex: 1 }]}>
              Use the <Text style={{ color: "#22c55e", fontWeight: "700" }}>Rescue</Text> tab to accept SOS requests and track victims in real-time.
            </Text>
          </View>
        </LinearGradient>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#64748b" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0f1e" },
  body: { paddingBottom: 40 },

  // Header
  headerGrad: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 13, color: "#94a3b8", fontWeight: "600", marginBottom: 4 },
  userName: { fontSize: 26, fontWeight: "800", color: "#fff", marginBottom: 10 },
  safeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ef444422", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start",
  },
  safeChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444" },
  safeChipText: { fontSize: 11, color: "#fca5a5", fontWeight: "700" },
  avatarBtn: { marginTop: 4 },
  avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 22, fontWeight: "800", color: "#fff" },

  // Stats
  statsRow: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 20, marginTop: -12, marginBottom: 20,
  },
  statCard: {
    flex: 1, backgroundColor: "#1e293b",
    borderRadius: 14, padding: 12, alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: "#334155",
  },
  statIconBox: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  statNum: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 10, color: "#64748b", fontWeight: "600", textTransform: "uppercase" },

  // SOS Button
  sosBtn: {
    borderRadius: 20, marginHorizontal: 20,
    shadowColor: "#ef4444", shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  sosBtnInner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 20,
  },
  sosIconCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#ffffff22", justifyContent: "center", alignItems: "center",
  },
  sosBtnTitle: { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  sosBtnSub: { fontSize: 12, color: "#fca5a5", marginTop: 3 },

  // Section
  sectionTitle: {
    fontSize: 11, color: "#64748b", fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 1.5,
    marginBottom: 12, marginHorizontal: 20,
  },

  // Action Cards
  actionsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 12, paddingHorizontal: 20, marginBottom: 20,
  },
  actionCard: { width: "47%", borderRadius: 16, overflow: "hidden" },
  actionCardGrad: { padding: 16, gap: 8, borderWidth: 1, borderColor: "#ffffff11", borderRadius: 16 },
  actionIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 14, fontWeight: "700", color: "#e2e8f0" },
  actionSub: { fontSize: 11, color: "#64748b" },

  // Info Card
  infoCard: {
    marginHorizontal: 20, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#334155", marginBottom: 16,
  },
  infoCardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  infoCardTitle: { fontSize: 14, fontWeight: "700", color: "#e2e8f0", marginBottom: 2 },
  infoCardSub: { fontSize: 12, color: "#94a3b8", lineHeight: 18 },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#14532d", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  onlineText: { fontSize: 10, color: "#22c55e", fontWeight: "800" },

  // Rescue Banner
  rescueBanner: { marginHorizontal: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: "#16a34a44" },
  rescueBannerInner: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  rescueBannerIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#22c55e22", justifyContent: "center", alignItems: "center" },
  rescueBannerTitle: { fontSize: 15, fontWeight: "800", color: "#bbf7d0" },
  rescueBannerSub: { fontSize: 12, color: "#86efac", marginTop: 3, textTransform: "capitalize" },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, marginHorizontal: 20,
    borderWidth: 1, borderColor: "#1e293b", borderRadius: 12,
  },
  logoutText: { color: "#64748b", fontSize: 14, fontWeight: "600" },
});
