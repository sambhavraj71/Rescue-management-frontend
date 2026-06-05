import { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

export default function ProfileScreen({ navigation, route }) {
  const [userName, setUserName] = useState(route?.params?.userName || "User");
  const [userId, setUserId] = useState(route?.params?.userId || "");
  const [role, setRole] = useState(route?.params?.role || "user");
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0 });
  const [contacts, setContacts] = useState([{ name: "", phone: "" }]);
  const [savingContacts, setSavingContacts] = useState(false);
  const [medical, setMedical] = useState({ bloodGroup: "", allergies: "", conditions: "", medications: "" });
  const [savingMedical, setSavingMedical] = useState(false);
  const [isSafe, setIsSafe] = useState(false);
  const [safeCheckedAt, setSafeCheckedAt] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(["userId", "userName", "role"]).then((vals) => {
      const uid = vals[0][1] || userId;
      const uName = vals[1][1] || userName;
      const uRole = vals[2][1] || role;
      if (vals[1][1]) setUserName(uName);
      if (vals[2][1]) setRole(uRole);
      if (uid && !userId) setUserId(uid);
      if (uid) loadUserData(uid, uRole, uName);
    });
  }, []);

  const loadUserData = (uid, uRole, uName) => {
    API.get(`/auth/profile/${uid}`).then((res) => {
      const u = res.data || {};
      if (u.emergencyContacts?.length) setContacts(u.emergencyContacts);
      if (u.medicalProfile) setMedical({
        bloodGroup: u.medicalProfile.bloodGroup || "",
        allergies: u.medicalProfile.allergies || "",
        conditions: u.medicalProfile.conditions || "",
        medications: u.medicalProfile.medications || "",
      });
      setIsSafe(u.isSafe || false);
      setSafeCheckedAt(u.safeCheckedAt || null);
    }).catch(() => {});

    if (uRole === "rescue" || uRole === "admin") {
      API.get(`/rescue/my-active/${encodeURIComponent(uName)}`).then((res) => {
        const data = res.data || [];
        setStats({ total: data.length, active: data.filter((s) => s.status !== "completed").length, completed: data.filter((s) => s.status === "completed").length });
      }).catch(() => {});
    } else {
      API.get(`/sos/user/${uid}`).then((res) => {
        const data = res.data || [];
        setStats({ total: data.length, active: data.filter((s) => s.status !== "completed").length, completed: data.filter((s) => s.status === "completed").length });
      }).catch(() => {});
    }
  };

  const saveContacts = async () => {
    const valid = contacts.filter((c) => c.name.trim() && c.phone.trim());
    if (!valid.length) { Alert.alert("Error", "Add at least one contact with name and phone"); return; }
    setSavingContacts(true);
    try {
      await API.post("/auth/emergency-contacts", { userId, contacts: valid });
      Alert.alert("Saved", "Emergency contacts updated!");
    } catch { Alert.alert("Error", "Failed to save"); }
    finally { setSavingContacts(false); }
  };

  const saveMedical = async () => {
    setSavingMedical(true);
    try {
      await API.post("/auth/medical-profile", { userId, medicalProfile: medical });
      Alert.alert("Saved", "Medical profile updated!");
    } catch { Alert.alert("Error", "Failed to save"); }
    finally { setSavingMedical(false); }
  };

  const doSafeCheckIn = async () => {
    setCheckingIn(true);
    try {
      const res = await API.post("/auth/safe-checkin", { userId });
      setIsSafe(true);
      setSafeCheckedAt(res.data.user?.safeCheckedAt || new Date());
      Alert.alert("✅ Safe Check-in", "Your emergency contacts have been notified that you're safe!");
    } catch { Alert.alert("Error", "Failed to check-in"); }
    finally { setCheckingIn(false); }
  };

  const isRescue = role === "rescue" || role === "admin";
  const avatarColor = isRescue ? ["#22c55e", "#16a34a"] : ["#ef4444", "#dc2626"];
  const roleLabel = role === "admin" ? "Administrator" : role === "rescue" ? "Rescue Team" : "User";
  const roleIcon = role === "admin" ? "shield" : role === "rescue" ? "shield-checkmark" : "person";
  const roleColor = role === "admin" ? "#a78bfa" : role === "rescue" ? "#22c55e" : "#38bdf8";

  const statsData = isRescue ? [
    { label: "Completed", value: stats.completed, color: "#22c55e", icon: "checkmark-circle" },
    { label: "Active",    value: stats.active,    color: "#f59e0b", icon: "pulse" },
    { label: "Total",     value: stats.total,     color: "#818cf8", icon: "radio" },
  ] : [
    { label: "Total SOS", value: stats.total,     color: "#818cf8", icon: "radio" },
    { label: "Active",    value: stats.active,    color: "#f59e0b", icon: "pulse" },
    { label: "Resolved",  value: stats.completed, color: "#22c55e", icon: "checkmark-circle" },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1e" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient colors={["#0f172a", "#1e1b4b"]} style={styles.hero}>
          <LinearGradient colors={avatarColor} style={styles.avatar}>
            <Text style={styles.avatarLetter}>{userName.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
          <View style={styles.heroBadge}>
            <Ionicons name={roleIcon} size={12} color={roleColor} />
            <Text style={[styles.heroBadgeText, { color: roleColor }]}>{roleLabel}</Text>
          </View>
          <Text style={styles.heroName}>{userName}</Text>
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online · Protected</Text>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          {statsData.map((s) => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: s.color + "22" }]}>
                <Ionicons name={s.icon} size={14} color={s.color} />
              </View>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Safe Check-in — sirf users */}
        {!isRescue && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safe Check-in</Text>
            <TouchableOpacity onPress={doSafeCheckIn} disabled={checkingIn} activeOpacity={0.85}>
              <LinearGradient colors={isSafe ? ["#052e16", "#14532d"] : ["#1a3a1a", "#166534"]} style={styles.safeBtn}>
                {checkingIn ? <ActivityIndicator color="#22c55e" /> : (
                  <>
                    <Ionicons name={isSafe ? "checkmark-circle" : "shield-checkmark"} size={26} color="#22c55e" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.safeBtnTitle}>{isSafe ? "✅ You're marked safe" : "I'm Safe — Notify Contacts"}</Text>
                      <Text style={styles.safeBtnSub}>
                        {safeCheckedAt ? `Last: ${new Date(safeCheckedAt).toLocaleString()}` : "Tap to notify emergency contacts"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#22c55e" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Emergency Contacts — sirf users */}
        {!isRescue && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <View style={styles.card}>
              {contacts.map((c, i) => (
                <View key={i} style={styles.contactRow}>
                  <View style={styles.contactFields}>
                    <TextInput
                      style={styles.input} placeholder="Name" placeholderTextColor="#475569"
                      value={c.name}
                      onChangeText={(v) => { const arr = [...contacts]; arr[i] = { ...arr[i], name: v }; setContacts(arr); }}
                    />
                    <TextInput
                      style={styles.input} placeholder="Phone" placeholderTextColor="#475569" keyboardType="phone-pad"
                      value={c.phone}
                      onChangeText={(v) => { const arr = [...contacts]; arr[i] = { ...arr[i], phone: v }; setContacts(arr); }}
                    />
                  </View>
                  {contacts.length > 1 && (
                    <TouchableOpacity onPress={() => setContacts(contacts.filter((_, idx) => idx !== i))}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity style={styles.addBtn} onPress={() => setContacts([...contacts, { name: "", phone: "" }])}>
                <Ionicons name="add-circle-outline" size={16} color="#38bdf8" />
                <Text style={styles.addBtnText}>Add Contact</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveContacts} disabled={savingContacts}>
                {savingContacts ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Contacts</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Medical Profile — sirf users */}
        {!isRescue && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medical Profile</Text>
            <View style={styles.card}>
              {[
                { key: "bloodGroup",  label: "Blood Group",        placeholder: "e.g. A+",             icon: "water" },
                { key: "allergies",   label: "Allergies",          placeholder: "e.g. Penicillin",      icon: "warning" },
                { key: "conditions",  label: "Medical Conditions", placeholder: "e.g. Diabetes",        icon: "heart" },
                { key: "medications", label: "Medications",        placeholder: "e.g. Metformin 500mg", icon: "medkit" },
              ].map((field) => (
                <View key={field.key} style={styles.medicalField}>
                  <View style={styles.medicalLabel}>
                    <Ionicons name={field.icon} size={14} color="#64748b" />
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                  </View>
                  <TextInput
                    style={styles.input} placeholder={field.placeholder} placeholderTextColor="#475569"
                    value={medical[field.key]}
                    onChangeText={(v) => setMedical({ ...medical, [field.key]: v })}
                  />
                </View>
              ))}
              <TouchableOpacity style={styles.saveBtn} onPress={saveMedical} disabled={savingMedical}>
                {savingMedical ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Medical Profile</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Info</Text>
          <View style={styles.infoCard}>
            {[
              { icon: "person-outline",          label: "Full Name", value: userName,      color: "#38bdf8" },
              { icon: "shield-checkmark-outline", label: "Role",     value: roleLabel,     color: roleColor },
              { icon: "id-card-outline",          label: "User ID",  value: userId || "N/A", color: "#94a3b8", mono: true },
            ].map((item, idx) => (
              <View key={item.label}>
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconBox, { backgroundColor: item.color + "22" }]}>
                    <Ionicons name={item.icon} size={16} color={item.color} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={[styles.infoValue, item.mono && styles.monoText]} numberOfLines={1}>{item.value}</Text>
                  </View>
                </View>
                {idx < 2 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={async () => { await AsyncStorage.multiRemove(["token", "userId", "userName", "role"]); navigation.replace("Login"); }}
            activeOpacity={0.8}
          >
            <LinearGradient colors={["#1a0000", "#450a0a"]} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={18} color="#fca5a5" />
              <Text style={styles.logoutText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0a0f1e" },
  hero: { alignItems: "center", paddingTop: 36, paddingBottom: 28, paddingHorizontal: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarLetter: { fontSize: 36, fontWeight: "800", color: "#fff" },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#ffffff11", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  heroBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  heroName: { fontSize: 24, fontWeight: "800", color: "#fff", marginBottom: 8 },
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#22c55e18", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  onlineText: { fontSize: 12, color: "#86efac", fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 20, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: "#1e293b", borderRadius: 14, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#334155" },
  statIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 9, color: "#64748b", fontWeight: "700", textTransform: "uppercase" },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 11, color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 },
  safeBtn: { borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#166534" },
  safeBtnTitle: { fontSize: 14, fontWeight: "700", color: "#86efac" },
  safeBtnSub: { fontSize: 11, color: "#4ade8088", marginTop: 2 },
  card: { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#334155" },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  contactFields: { flex: 1, gap: 6 },
  input: { backgroundColor: "#0f172a", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: "#e2e8f0", fontSize: 14, borderWidth: 1, borderColor: "#334155" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14, marginTop: 4 },
  addBtnText: { color: "#38bdf8", fontWeight: "600", fontSize: 13 },
  saveBtn: { backgroundColor: "#ef4444", borderRadius: 10, padding: 12, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  medicalField: { marginBottom: 12 },
  medicalLabel: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  fieldLabel: { fontSize: 11, color: "#64748b", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  infoCard: { backgroundColor: "#1e293b", borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: "#334155" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  infoIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, color: "#64748b", fontWeight: "600", marginBottom: 2, textTransform: "uppercase" },
  infoValue: { fontSize: 14, fontWeight: "700", color: "#e2e8f0" },
  monoText: { fontFamily: "monospace", fontSize: 12, color: "#64748b" },
  divider: { height: 1, backgroundColor: "#334155", marginLeft: 48 },
  logoutBtn: { borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#7f1d1d44", marginBottom: 30 },
  logoutText: { color: "#fca5a5", fontSize: 15, fontWeight: "700" },
});
