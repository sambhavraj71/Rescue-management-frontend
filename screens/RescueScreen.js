import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, StatusBar,
  FlatList, TouchableOpacity, Alert, ActivityIndicator,
  Linking, RefreshControl, ScrollView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import API from "../services/api";

const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  if (km > 500) return null;
  return km < 1 ? `${Math.round(km*1000)}m away` : `${km.toFixed(1)}km away`;
};

const STATUS_COLOR = {
  pending:   { bg: "#78350f", text: "#fde68a" },
  assigned:  { bg: "#0c4a6e", text: "#bae6fd" },
  accepted:  { bg: "#14532d", text: "#bbf7d0" },
  completed: { bg: "#1e293b", text: "#94a3b8" },
};

const EMERGENCY_ICON = {
  Fire: "flame", Flood: "water", Earthquake: "earth",
  Accident: "car", Medical: "medkit", "Voice Emergency": "mic",
};

export default function RescueScreen({ route }) {
  const teamName = route?.params?.userName || "Rescue Team";

  const [tab, setTab] = useState("dashboard");
  const [pending, setPending] = useState([]);
  const [myActive, setMyActive] = useState([]);
  const [myHistory, setMyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const locationInterval = useRef(null);
  const activeSosId = useRef(null);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [p, a] = await Promise.all([
        API.get("/rescue/pending"),
        API.get(`/rescue/my-active/${encodeURIComponent(teamName)}`),
      ]);
      setPending(p.data || []);
      const activeList = (a.data || []).filter((s) => s.status !== "completed");
      const historyList = (a.data || []).filter((s) => s.status === "completed");
      setMyActive(activeList);
      setMyHistory(historyList);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teamName]);

  useEffect(() => {
    fetchData();
    // Get rescue team's location for distance calculation
    if (Platform.OS === "web") {
      navigator?.geolocation?.getCurrentPosition(
        (p) => setUserLocation({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => {}, { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status !== "granted") return;
        Location.getCurrentPositionAsync({}).then((loc) =>
          setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude })
        ).catch(() => {});
      });
    }
    const interval = setInterval(() => fetchData(true), 10000);
    return () => {
      clearInterval(interval);
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, [fetchData]);

  const startLiveLocation = async (sosId) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    activeSosId.current = sosId;
    if (locationInterval.current) clearInterval(locationInterval.current);
    locationInterval.current = setInterval(async () => {
      try {
        // Try high accuracy first, fallback to low accuracy
        let loc;
        try {
          loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        } catch {
          loc = await Location.getLastKnownPositionAsync();
        }
        if (!loc) return;
        await API.post(`/rescue/location/${sosId}`, {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          teamName,
        });
      } catch (e) {
        console.log("Location error:", e);
      }
    }, 5000);
  };

  const handleAccept = async (sosId) => {
    try {
      setActionLoading(sosId + "accept");
      await API.post(`/rescue/accept/${sosId}`, { teamName });
      if (typeof window !== "undefined") window.alert("✅ Accepted! Navigating to victim.");
      await fetchData(true);
      startLiveLocation(sosId);
      setTab("mycases");
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to accept";
      if (typeof window !== "undefined") window.alert(msg);
      else Alert.alert("Error", msg);
    } finally {
      setActionLoading("");
    }
  };

  const handleComplete = (sosId) => {
    const doComplete = async () => {
      try {
        setActionLoading(sosId + "complete");
        await API.post(`/rescue/complete/${sosId}`, { teamName });
        if (locationInterval.current) clearInterval(locationInterval.current);
        activeSosId.current = null;
        await fetchData(true);
        setTab("mycases");
      } catch (e) {
        const msg = e?.response?.data?.message || "Failed to complete";
        Alert.alert("Error", msg);
      } finally {
        setActionLoading("");
      }
    };

    if (typeof window !== "undefined" && window.confirm) {
      if (window.confirm("Confirm rescue operation is completed?")) doComplete();
    } else {
      Alert.alert("Confirm", "Rescue operation completed?", [
        { text: "Cancel", style: "cancel" },
        { text: "Complete", onPress: doComplete },
      ]);
    }
  };

  const openMaps = (lat, lng) => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`)
      .catch(() => Alert.alert("Error", "Could not open maps"));
  };

  // ── Dashboard Tab ──────────────────────────────────────────
  const renderDashboard = () => (
    <ScrollView contentContainerStyle={styles.dashContainer}>
      <Text style={styles.greetTitle}>👋 Hello, {teamName}</Text>
      <Text style={styles.greetSub}>Rescue Team Dashboard</Text>

      <View style={styles.statsRow}>
        <TouchableOpacity style={[styles.statBox, { borderColor: "#f59e0b" }]} onPress={() => setTab("requests")}>
          <Text style={[styles.statNum, { color: "#f59e0b" }]}>{pending.length}</Text>
          <Text style={styles.statLbl}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statBox, { borderColor: "#22c55e" }]} onPress={() => setTab("mycases")}>
          <Text style={[styles.statNum, { color: "#22c55e" }]}>{myActive.length}</Text>
          <Text style={styles.statLbl}>My Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statBox, { borderColor: "#64748b" }]} onPress={() => setTab("mycases")}>
          <Text style={[styles.statNum, { color: "#64748b" }]}>{myHistory.length}</Text>
          <Text style={styles.statLbl}>Completed</Text>
        </TouchableOpacity>
      </View>

      {activeSosId.current && (
        <View style={styles.liveCard}>
          <View style={styles.liveDot} />
          <Text style={styles.liveCardText}>Broadcasting live location for active SOS</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        <TouchableOpacity style={styles.quickBtn} onPress={() => setTab("requests")}>
          <Ionicons name="notifications" size={26} color="#f59e0b" />
          <Text style={styles.quickText}>View Requests</Text>
          {pending.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pending.length}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={() => setTab("mycases")}>
          <Ionicons name="shield-checkmark" size={26} color="#22c55e" />
          <Text style={styles.quickText}>My Cases</Text>
        </TouchableOpacity>
      </View>

      {pending.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>Latest SOS Request</Text>
          <View style={styles.previewCard}>
            <Text style={styles.previewType}>{pending[0].emergencyType}</Text>
            <Text style={styles.previewInfo}>👤 {pending[0].userId?.name || "Unknown"}</Text>
            <Text style={styles.previewInfo}>📍 {pending[0].latitude?.toFixed(4)}, {pending[0].longitude?.toFixed(4)}</Text>
            {pending[0].notes ? <Text style={styles.previewNote}>📝 {pending[0].notes}</Text> : null}
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.navBtn} onPress={() => openMaps(pending[0].latitude, pending[0].longitude)}>
                <Ionicons name="navigate" size={14} color="#38bdf8" />
                <Text style={styles.navText}>Navigate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                disabled={!!actionLoading}
                onPress={() => handleAccept(pending[0]._id)}
              >
                <Text style={styles.acceptText}>Accept Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ── Requests Tab ───────────────────────────────────────────
  const renderRequestCard = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name={EMERGENCY_ICON[item.emergencyType] || "warning"} size={20} color="#fca5a5" />
          <Text style={styles.emergencyType}>{item.emergencyType}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status]?.bg }]}>
          <Text style={[styles.statusText, { color: STATUS_COLOR[item.status]?.text }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.infoText}>👤 {item.userId?.name || "Unknown"}</Text>
      <Text style={styles.infoText}>📍 {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}</Text>
      {item.notes ? <Text style={styles.noteText}>📝 {item.notes}</Text> : null}
      <Text style={styles.timeText}>🕐 {new Date(item.createdAt).toLocaleString()}</Text>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => openMaps(item.latitude, item.longitude)}>
          <Ionicons name="navigate" size={14} color="#38bdf8" />
          <Text style={styles.navText}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptBtn, actionLoading === item._id + "accept" && styles.disabledBtn]}
          disabled={actionLoading === item._id + "accept"}
          onPress={() => handleAccept(item._id)}
        >
          {actionLoading === item._id + "accept"
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.acceptText}>Accept Request</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── My Cases Tab ───────────────────────────────────────────
  const renderActiveCard = ({ item }) => {
    const dist = getDistance(userLocation?.lat, userLocation?.lon, item.latitude, item.longitude);
    const med = item.userId?.medicalProfile;
    const contacts = item.userId?.emergencyContacts;
    return (
    <View key={item._id} style={[styles.card, { borderColor: "#22c55e" }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name={EMERGENCY_ICON[item.emergencyType] || "warning"} size={20} color="#22c55e" />
          <Text style={styles.emergencyType}>{item.emergencyType}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: "#14532d" }]}>
          <Text style={[styles.statusText, { color: "#bbf7d0" }]}>In Progress</Text>
        </View>
      </View>
      <Text style={styles.infoText}>👤 {item.userId?.name || "Unknown"} — {item.userId?.email || ""}</Text>
      <Text style={styles.infoText}>📍 {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}</Text>
      {dist && (
        <Text style={[styles.infoText, { color: "#a78bfa" }]}>📏 {dist}</Text>
      )}

      {/* Medical Profile */}
      {med && (med.bloodGroup || med.allergies || med.conditions || med.medications) && (
        <View style={styles.medBox}>
          <Text style={styles.medTitle}>🩺 Medical Info</Text>
          {med.bloodGroup ? <Text style={styles.medItem}>🩸 Blood: {med.bloodGroup}</Text> : null}
          {med.allergies  ? <Text style={styles.medItem}>⚠️ Allergies: {med.allergies}</Text> : null}
          {med.conditions ? <Text style={styles.medItem}>💊 Conditions: {med.conditions}</Text> : null}
          {med.medications? <Text style={styles.medItem}>💉 Medications: {med.medications}</Text> : null}
        </View>
      )}

      {/* Emergency Contacts */}
      {contacts?.length > 0 && (
        <View style={styles.medBox}>
          <Text style={styles.medTitle}>📞 Emergency Contacts</Text>
          {contacts.map((c, i) => (
            <TouchableOpacity key={i} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
              <Text style={[styles.medItem, { color: "#38bdf8" }]}>• {c.name}: {c.phone}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Live location broadcasting active</Text>
      </View>
      {item.statusHistory?.length > 0 && (
        <View style={styles.historyBox}>
          {item.statusHistory.slice(-2).map((h, i) => (
            <Text key={`${item._id}-h-${i}`} style={styles.historyItem}>• {h.status} — {h.note}</Text>
          ))}
        </View>
      )}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.navBtn} onPress={() => openMaps(item.latitude, item.longitude)}>
          <Ionicons name="navigate" size={14} color="#38bdf8" />
          <Text style={styles.navText}>Navigate</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.completeBtn, actionLoading === item._id + "complete" && styles.disabledBtn]}
          disabled={actionLoading === item._id + "complete"}
          onPress={() => handleComplete(item._id)}
        >
          {actionLoading === item._id + "complete"
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.acceptText}>✅ Mark Complete</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
  };

  const renderHistoryCard = ({ item }) => (
    <View key={item._id} style={[styles.card, { opacity: 0.7 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name={EMERGENCY_ICON[item.emergencyType] || "warning"} size={18} color="#64748b" />
          <Text style={[styles.emergencyType, { color: "#94a3b8" }]}>{item.emergencyType}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: "#1e293b" }]}>
          <Text style={[styles.statusText, { color: "#64748b" }]}>Completed</Text>
        </View>
      </View>
      <Text style={styles.infoText}>👤 {item.userId?.name || "Unknown"}</Text>
      <Text style={styles.timeText}>✅ {new Date(item.updatedAt).toLocaleString()}</Text>
    </View>
  );

  const renderMyCases = () => (
    <ScrollView style={{ flex: 1 }}>
      {myActive.length > 0 && (
        <View>
          <Text style={styles.sectionHeader}>🟢 Active Cases ({myActive.length})</Text>
          {myActive.map((item) => renderActiveCard({ item }))}
        </View>
      )}
      {myActive.length === 0 && (
        <View style={styles.emptyBox}>
          <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
          <Text style={styles.emptyText}>No active assignments</Text>
        </View>
      )}
      {myHistory.length > 0 && (
        <View>
          <Text style={styles.sectionHeader}>📋 Completed History ({myHistory.length})</Text>
          {myHistory.map((item) => renderHistoryCard({ item }))}
        </View>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🚨 RescueApp</Text>
          <Text style={styles.headerSub}>🛡 {teamName}</Text>
        </View>
        <View style={styles.headerRight}>
          {activeSosId.current && <View style={styles.livePing} />}
          <Ionicons name="shield-checkmark" size={32} color="#22c55e" />
        </View>
      </View>

      <View style={styles.tabBar}>
        {[
          { id: "dashboard", label: "Dashboard", icon: "grid" },
          { id: "requests", label: `Requests (${pending.length})`, icon: "notifications" },
          { id: "mycases", label: `My Cases (${myActive.length + myHistory.length})`, icon: "shield-checkmark" },
        ].map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tabItem, tab === t.id && styles.tabActive]} onPress={() => setTab(t.id)}>
            <Ionicons name={t.icon} size={16} color={tab === t.id ? "#ef4444" : "#64748b"} />
            <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator color="#ef4444" size="large" style={{ marginTop: 40 }} />
      ) : (
        <View style={{ flex: 1 }}>
          {tab === "dashboard" && renderDashboard()}
          {tab === "requests" && (
            <FlatList
              data={pending}
              keyExtractor={(item) => item._id}
              renderItem={renderRequestCard}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#ef4444" />}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                  <Text style={styles.emptyText}>No pending SOS requests</Text>
                </View>
              }
            />
          )}
          {tab === "mycases" && renderMyCases()}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "#1e293b", borderBottomWidth: 1, borderBottomColor: "#334155",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  headerSub: { fontSize: 12, color: "#22c55e", marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  livePing: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22c55e" },

  tabBar: { flexDirection: "row", backgroundColor: "#1e293b", borderBottomWidth: 1, borderBottomColor: "#334155" },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: "center", gap: 3 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#ef4444" },
  tabLabel: { color: "#64748b", fontSize: 10, fontWeight: "600" },
  tabLabelActive: { color: "#fff" },

  dashContainer: { padding: 16, paddingBottom: 40 },
  greetTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  greetSub: { fontSize: 13, color: "#94a3b8", marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: "#1e293b", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1 },
  statNum: { fontSize: 26, fontWeight: "800" },
  statLbl: { fontSize: 11, color: "#94a3b8", marginTop: 3 },
  liveCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#14532d", borderRadius: 10, padding: 12, marginBottom: 16 },
  liveCardText: { color: "#bbf7d0", fontSize: 13, fontWeight: "600" },
  sectionTitle: { color: "#94a3b8", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  quickGrid: { flexDirection: "row", gap: 12, marginBottom: 20 },
  quickBtn: { flex: 1, backgroundColor: "#1e293b", borderRadius: 14, padding: 18, alignItems: "center", gap: 8, position: "relative" },
  quickText: { color: "#e2e8f0", fontSize: 13, fontWeight: "600" },
  badge: { position: "absolute", top: 8, right: 8, backgroundColor: "#ef4444", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  previewCard: { backgroundColor: "#1e293b", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#f59e0b" },
  previewType: { fontSize: 16, fontWeight: "800", color: "#fca5a5", marginBottom: 8 },
  previewInfo: { color: "#94a3b8", fontSize: 13, marginBottom: 4 },
  previewNote: { color: "#cbd5e1", fontSize: 12, fontStyle: "italic", marginBottom: 8 },
  previewActions: { flexDirection: "row", gap: 10, marginTop: 10 },

  list: { padding: 16, gap: 12, paddingBottom: 30 },
  card: { backgroundColor: "#1e293b", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#334155", marginHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  emergencyType: { fontSize: 15, fontWeight: "800", color: "#fca5a5" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "700" },
  infoText: { color: "#94a3b8", fontSize: 13, marginBottom: 4 },
  noteText: { color: "#cbd5e1", fontSize: 12, fontStyle: "italic", marginTop: 4 },
  timeText: { color: "#475569", fontSize: 11, marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#38bdf8", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  navText: { color: "#38bdf8", fontWeight: "700", fontSize: 12 },
  acceptBtn: { flex: 1, backgroundColor: "#16a34a", paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  completeBtn: { flex: 1, backgroundColor: "#2563eb", paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  acceptText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  disabledBtn: { opacity: 0.5 },

  liveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  liveText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },

  historyBox: { backgroundColor: "#0f172a", borderRadius: 8, padding: 10, marginTop: 8 },
  historyItem: { color: "#64748b", fontSize: 11, marginBottom: 3 },

  medBox: { backgroundColor: "#0f172a", borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: "#1e3a2e" },
  medTitle: { color: "#22c55e", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  medItem: { color: "#94a3b8", fontSize: 12, marginBottom: 3 },

  sectionHeader: { color: "#94a3b8", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, paddingHorizontal: 16, paddingVertical: 10 },
  emptyBox: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: "#64748b", fontSize: 15 },
});
