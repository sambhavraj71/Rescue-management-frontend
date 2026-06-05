import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View, Text, StyleSheet, FlatList, StatusBar,
  TouchableOpacity, ActivityIndicator, Image,
  RefreshControl, Modal, ScrollView, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { io } from "socket.io-client";
import { Platform } from "react-native";
import API from "../services/api";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:5000";

const STATUS_CONFIG = {
  pending:   { color: "#f59e0b", bg: "#78350f", icon: "time-outline",            label: "Pending" },
  assigned:  { color: "#38bdf8", bg: "#0c4a6e", icon: "person-add-outline",      label: "Assigned" },
  accepted:  { color: "#22c55e", bg: "#14532d", icon: "checkmark-circle-outline", label: "Accepted" },
  completed: { color: "#64748b", bg: "#1e293b", icon: "checkmark-done-outline",  label: "Completed" },
};

const TYPE_CONFIG = {
  Flood:            { icon: "water",  color: "#38bdf8", grad: ["#082f49", "#0c4a6e"] },
  Fire:             { icon: "flame",  color: "#ef4444", grad: ["#450a0a", "#7f1d1d"] },
  Earthquake:       { icon: "earth",  color: "#f59e0b", grad: ["#431407", "#78350f"] },
  Accident:         { icon: "car",    color: "#f97316", grad: ["#431407", "#7c2d12"] },
  Medical:          { icon: "medkit", color: "#22c55e", grad: ["#052e16", "#14532d"] },
  "Voice Emergency":{ icon: "mic",   color: "#a855f7", grad: ["#2e1065", "#4c1d95"] },
};

const STATUS_ORDER = ["pending", "assigned", "accepted", "completed"];

const formatRelative = (isoDate) => {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// Haversine distance in km
const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (km) => {
  if (km === null) return null;
  if (km > 500) return null; // Clearly wrong location data, hide karo
  if (km < 0.05) return null; // Same location, meaningless
  return km < 1 ? `${Math.round(km * 1000)}m away` : `${km.toFixed(1)}km away`;
};

export default function AlertsScreen({ route }) {
  const [userId, setUserId] = useState(route?.params?.userId || null);
  const [userName, setUserName] = useState(route?.params?.userName || "");
  const [role, setRole] = useState(route?.params?.role || "user");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);

  // In-app notification toast state
  const [toast, setToast] = useState(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;
  const socketRef = useRef(null);

  useEffect(() => {
    AsyncStorage.multiGet(["userId", "userName", "role"]).then((vals) => {
      if (vals[0][1]) setUserId(vals[0][1]);
      if (vals[1][1]) setUserName(vals[1][1]);
      if (vals[2][1]) setRole(vals[2][1]);
    }).then(() => loadStatus());
  }, []);

  // Get user's current location for distance calculation
  useEffect(() => {
    setLocationLoading(true);
    if (Platform.OS === "web") {
      if (navigator?.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            setLocationLoading(false);
          },
          () => setLocationLoading(false),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        setLocationLoading(false);
      }
    } else {
      Location.requestForegroundPermissionsAsync().then(({ status }) => {
        if (status !== "granted") { setLocationLoading(false); return; }
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          .then((loc) => {
            setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
            setLocationLoading(false);
          })
          .catch(() => setLocationLoading(false));
      });
    }
  }, []);

  // Socket for real-time status updates + in-app notifications
  useEffect(() => {
    if (!userId) return;
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("sosStatusUpdated", (updatedSOS) => {
      // Only show toast if this SOS belongs to current user
      const sosUserId = updatedSOS.userId?._id || updatedSOS.userId;
      if (sosUserId?.toString() === userId?.toString()) {
        const statusMessages = {
          assigned: { title: "🚨 Team Assigned!", body: `Rescue team "${updatedSOS.assignedRescueTeamName || "rescue"}" has been assigned to your case`, color: "#38bdf8" },
          accepted: { title: "🏃 Team On The Way!", body: "Rescue team has accepted and is heading to you", color: "#22c55e" },
          completed: { title: "✅ Case Resolved", body: "Your emergency case has been marked complete", color: "#64748b" },
        };
        const msg = statusMessages[updatedSOS.status];
        if (msg) showToast(msg);

        // Update items list
        setItems((prev) =>
          prev.map((i) => (i._id === updatedSOS._id ? { ...i, ...updatedSOS } : i))
        );
      }
    });

    socket.on("sosUpdated", (updatedSOS) => {
      setItems((prev) =>
        prev.map((i) => (i._id === updatedSOS._id ? { ...i, ...updatedSOS } : i))
      );
    });

    return () => socket.disconnect();
  }, [userId]);

  const showToast = ({ title, body, color }) => {
    setToast({ title, body, color });
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 80 }),
      Animated.delay(4000),
      Animated.timing(toastAnim, { toValue: -120, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  const loadStatus = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // AsyncStorage se fresh values lo — state update delay se bachne ke liye
      const stored = await AsyncStorage.multiGet(["userId", "userName", "role"]);
      const uid  = stored[0][1] || userId;
      const name = stored[1][1] || userName;
      const r    = stored[2][1] || role;
      if (!uid) { setLoading(false); return; }
      const isRescueRole = r === "rescue" || r === "admin";
      let res;
      if (isRescueRole) {
        res = await API.get(`/rescue/my-active/${encodeURIComponent(name)}`);
      } else {
        res = await API.get(`/sos/user/${uid}`);
      }
      setItems(res.data || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => loadStatus(true), 12000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const activeCount = useMemo(() => items.filter((i) => i.status !== "completed").length, [items]);
  const completedCount = useMemo(() => items.filter((i) => i.status === "completed").length, [items]);

  const renderCard = ({ item }) => {
    const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const tc = TYPE_CONFIG[item.emergencyType] || { icon: "warning", color: "#ef4444", grad: ["#450a0a", "#7f1d1d"] };
    const statusIdx = STATUS_ORDER.indexOf(item.status);
    const distKm = getDistance(userLocation?.lat, userLocation?.lon, item.latitude, item.longitude);
    const distLabel = formatDistance(distKm);

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => setSelected(item)}>
        <View style={[styles.card, { borderLeftColor: tc.color }]}>
          {/* Top Row */}
          <View style={styles.cardTop}>
            <LinearGradient colors={tc.grad} style={styles.typeIcon}>
              <Ionicons name={tc.icon} size={20} color={tc.color} />
            </LinearGradient>
            <View style={styles.cardTopInfo}>
              <Text style={[styles.cardType, { color: tc.color }]}>{item.emergencyType}</Text>
              <Text style={styles.cardTime}>{formatRelative(item.updatedAt)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Ionicons name={sc.icon} size={11} color={sc.color} />
              <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressRow}>
            {STATUS_ORDER.map((s, idx) => (
              <View key={s} style={styles.progressStep}>
                <View style={[
                  styles.progressDot,
                  idx <= statusIdx && { backgroundColor: STATUS_CONFIG[s].color },
                  idx === statusIdx && styles.progressDotActive,
                ]} />
                {idx < STATUS_ORDER.length - 1 && (
                  <View style={[styles.progressLine, idx < statusIdx && { backgroundColor: "#334155" }]} />
                )}
              </View>
            ))}
          </View>
          <View style={styles.progressLabels}>
            {STATUS_ORDER.map((s, idx) => (
              <Text key={s} style={[styles.progressLabel, idx <= statusIdx && { color: STATUS_CONFIG[s].color }]}>
                {STATUS_CONFIG[s].label}
              </Text>
            ))}
          </View>

          {/* Info Row */}
          <View style={styles.cardInfo}>
            <View style={styles.cardInfoItem}>
              <Ionicons name="location-outline" size={12} color="#64748b" />
              <Text style={styles.cardInfoText}>{item.latitude?.toFixed(3)}, {item.longitude?.toFixed(3)}</Text>
            </View>
            {/* Distance */}
            {distLabel && (
              <View style={styles.cardInfoItem}>
                <Ionicons name="navigate-outline" size={12} color="#a78bfa" />
                <Text style={[styles.cardInfoText, { color: "#a78bfa" }]}>{distLabel}</Text>
              </View>
            )}
            {item.assignedRescueTeamName ? (
              <View style={styles.cardInfoItem}>
                <Ionicons name="shield-checkmark-outline" size={12} color="#22c55e" />
                <Text style={[styles.cardInfoText, { color: "#86efac" }]}>{item.assignedRescueTeamName}</Text>
              </View>
            ) : (
              <View style={styles.cardInfoItem}>
                <Ionicons name="time-outline" size={12} color="#f59e0b" />
                <Text style={[styles.cardInfoText, { color: "#fde68a" }]}>Awaiting assignment</Text>
              </View>
            )}
          </View>

          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.imageThumb} resizeMode="cover" />
          ) : null}

          <Text style={styles.tapHint}>Tap to view details →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />

      {/* In-app Toast Notification */}
      {toast && (
        <Animated.View style={[styles.toast, { transform: [{ translateY: toastAnim }], borderLeftColor: toast.color }]}>
          <Ionicons name="notifications" size={18} color={toast.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.toastTitle, { color: toast.color }]}>{toast.title}</Text>
            <Text style={styles.toastBody}>{toast.body}</Text>
          </View>
        </Animated.View>
      )}

      {/* Header */}
      <LinearGradient colors={["#0f172a", "#1e1b4b"]} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {(role === "rescue" || role === "admin") ? "My Assigned Cases" : "My SOS Alerts"}
          </Text>
          <View style={styles.headerSubRow}>
            <Text style={styles.headerSub}>
              {(role === "rescue" || role === "admin") ? "Cases you accepted" : "Live rescue tracking"}
            </Text>
            {locationLoading ? (
              <View style={styles.locPill}>
                <ActivityIndicator size={8} color="#64748b" />
                <Text style={styles.locPillText}>Getting location...</Text>
              </View>
            ) : userLocation ? (
              <View style={[styles.locPill, { backgroundColor: "#052e16" }]}>
                <View style={[styles.locDot, { backgroundColor: "#22c55e" }]} />
                <Text style={[styles.locPillText, { color: "#86efac" }]}>Location active</Text>
              </View>
            ) : (
              <View style={[styles.locPill, { backgroundColor: "#431407" }]}>
                <Ionicons name="location-off-outline" size={10} color="#f97316" />
                <Text style={[styles.locPillText, { color: "#fb923c" }]}>Allow location</Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); loadStatus(true); }}>
          <Ionicons name="refresh" size={18} color="#38bdf8" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Total",    value: items.length,  color: "#818cf8", icon: "radio" },
          { label: "Active",   value: activeCount,   color: "#f59e0b", icon: "pulse" },
          { label: "Resolved", value: completedCount, color: "#22c55e", icon: "checkmark-done" },
        ].map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Ionicons name={s.icon} size={16} color={s.color} />
            <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#ef4444" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStatus(true)} tintColor="#ef4444" />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <LinearGradient colors={["#1e293b", "#111827"]} style={styles.emptyCard}>
                <Ionicons name="radio-outline" size={44} color="#334155" />
                <Text style={styles.emptyTitle}>No SOS Sent Yet</Text>
                <Text style={styles.emptySub}>Your emergency alerts will appear here</Text>
              </LinearGradient>
            </View>
          }
          renderItem={renderCard}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selected && (() => {
              const sc = STATUS_CONFIG[selected.status] || STATUS_CONFIG.pending;
              const tc = TYPE_CONFIG[selected.emergencyType] || { icon: "warning", color: "#ef4444", grad: ["#450a0a", "#7f1d1d"] };
              const distKm = getDistance(userLocation?.lat, userLocation?.lon, selected.latitude, selected.longitude);
              const distLabel = formatDistance(distKm);
              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.modalHandle} />
                  <LinearGradient colors={tc.grad} style={styles.modalHeader}>
                    <View style={styles.modalHeaderRow}>
                      <View style={[styles.modalTypeIcon, { backgroundColor: tc.color + "33" }]}>
                        <Ionicons name={tc.icon} size={28} color={tc.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modalType, { color: tc.color }]}>{selected.emergencyType}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: sc.bg, alignSelf: "flex-start" }]}>
                          <Ionicons name={sc.icon} size={11} color={sc.color} />
                          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                        <Ionicons name="close" size={20} color="#64748b" />
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>

                  {selected.imageUrl && (
                    <Image source={{ uri: selected.imageUrl }} style={styles.modalImage} resizeMode="cover" />
                  )}

                  <View style={styles.modalBody}>
                    {[
                      { icon: "location",         label: "Location",    value: `${selected.latitude?.toFixed(5)}, ${selected.longitude?.toFixed(5)}`, color: "#38bdf8" },
                      distLabel && { icon: "navigate", label: "Distance from you", value: distLabel, color: "#a78bfa" },
                      { icon: "shield-checkmark", label: "Rescue Team", value: selected.assignedRescueTeamName || "Not assigned yet", color: "#22c55e" },
                      { icon: "time",             label: "Sent",        value: new Date(selected.createdAt).toLocaleString(), color: "#94a3b8" },
                      { icon: "create",           label: "Notes",       value: selected.notes || "—", color: "#cbd5e1" },
                    ].filter(Boolean).map((d) => (
                      <View key={d.label} style={styles.detailRow}>
                        <View style={[styles.detailIcon, { backgroundColor: d.color + "22" }]}>
                          <Ionicons name={d.icon} size={14} color={d.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailLabel}>{d.label}</Text>
                          <Text style={styles.detailValue}>{d.value}</Text>
                        </View>
                      </View>
                    ))}

                    {/* Status Timeline */}
                    {selected.statusHistory?.length > 0 && (
                      <View style={styles.timeline}>
                        <Text style={styles.timelineTitle}>Status Timeline</Text>
                        {selected.statusHistory.map((h, i) => {
                          const hsc = STATUS_CONFIG[h.status] || STATUS_CONFIG.pending;
                          return (
                            <View key={i} style={styles.timelineRow}>
                              <View style={[styles.timelineDot, { backgroundColor: hsc.color }]} />
                              {i < selected.statusHistory.length - 1 && <View style={styles.timelineConnector} />}
                              <View style={styles.timelineContent}>
                                <Text style={[styles.timelineStatus, { color: hsc.color }]}>{h.status}</Text>
                                {h.note ? <Text style={styles.timelineNote}>{h.note}</Text> : null}
                                <Text style={styles.timelineBy}>by {h.updatedBy}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0f1e" },

  // Toast
  toast: {
    position: "absolute", top: 10, left: 16, right: 16, zIndex: 999,
    backgroundColor: "#1e293b", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderLeftWidth: 4, borderWidth: 1, borderColor: "#334155",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, elevation: 10,
  },
  toastTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  toastBody: { fontSize: 12, color: "#94a3b8" },

  header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  locPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1e293b", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  locDot: { width: 5, height: 5, borderRadius: 3 },
  locPillText: { fontSize: 9, color: "#64748b", fontWeight: "600" },
  refreshBtn: { backgroundColor: "#1e293b", borderWidth: 1, borderColor: "#334155", borderRadius: 10, padding: 9 },

  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#1e293b", borderRadius: 12, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#334155" },
  statNum: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 9, color: "#64748b", fontWeight: "700", textTransform: "uppercase" },

  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },

  card: { backgroundColor: "#1e293b", borderRadius: 16, padding: 14, borderLeftWidth: 3, borderWidth: 1, borderColor: "#334155" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  typeIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cardTopInfo: { flex: 1 },
  cardType: { fontSize: 15, fontWeight: "800" },
  cardTime: { fontSize: 11, color: "#64748b", marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: "700" },

  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  progressStep: { flex: 1, flexDirection: "row", alignItems: "center" },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#334155" },
  progressDotActive: { width: 10, height: 10, borderRadius: 5 },
  progressLine: { flex: 1, height: 2, backgroundColor: "#1e293b" },
  progressLabels: { flexDirection: "row", marginBottom: 10 },
  progressLabel: { flex: 1, fontSize: 8, color: "#475569", textAlign: "center", fontWeight: "600" },

  cardInfo: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  cardInfoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardInfoText: { fontSize: 11, color: "#64748b" },

  imageThumb: { width: "100%", height: 150, borderRadius: 10, marginTop: 10 },
  tapHint: { fontSize: 10, color: "#334155", textAlign: "right", marginTop: 8, fontWeight: "600" },

  empty: { paddingHorizontal: 20, paddingTop: 40 },
  emptyCard: { borderRadius: 20, padding: 32, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#334155" },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#475569" },
  emptySub: { fontSize: 13, color: "#334155", textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "#000000aa", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#0f172a", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", borderTopWidth: 1, borderColor: "#334155" },
  modalHandle: { width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  modalHeader: { padding: 20 },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  modalTypeIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  modalType: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  closeBtn: { backgroundColor: "#1e293b", borderRadius: 10, padding: 8 },
  modalImage: { width: "100%", height: 200 },
  modalBody: { padding: 20, gap: 12 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#1e293b", borderRadius: 12, padding: 12 },
  detailIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  detailLabel: { fontSize: 10, color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  detailValue: { fontSize: 13, color: "#e2e8f0", fontWeight: "600" },

  timeline: { backgroundColor: "#1e293b", borderRadius: 14, padding: 16, marginTop: 4, paddingBottom: 20 },
  timelineTitle: { fontSize: 11, color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 },
  timelineRow: { flexDirection: "row", gap: 12, position: "relative" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, zIndex: 1 },
  timelineConnector: { position: "absolute", left: 4.5, top: 14, width: 1, height: "100%", backgroundColor: "#334155" },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineStatus: { fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  timelineNote: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  timelineBy: { fontSize: 11, color: "#475569", marginTop: 2 },
});
