import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ProfileScreen({ navigation, route }) {
  const userName = route?.params?.userName || "User";
  const userId = route?.params?.userId || "N/A";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚨 RescueApp</Text>
        <Ionicons name="person-circle" size={42} color="#ef4444" />
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={50} color="#ef4444" />
        </View>
        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.role}>Rescue User</Text>
      </View>

      {/* Info Cards */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color="#38bdf8" />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{userName}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Ionicons name="id-card-outline" size={20} color="#38bdf8" />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {userId}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#38bdf8" />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Role</Text>
            <Text style={styles.infoValue}>User</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Ionicons name="ellipse" size={12} color="#22c55e" style={{ marginTop: 4 }} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: "#22c55e" }]}>Active</Text>
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => {
          await AsyncStorage.multiRemove(["token", "userId", "userName"]);
          navigation.replace("Login");
        }}
      >
        <Ionicons name="log-out-outline" size={20} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ef4444",
    marginBottom: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  role: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: "#1e293b",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 10,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: "#e2e8f0",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#334155",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    marginHorizontal: 20,
    marginTop: 25,
    paddingVertical: 15,
    borderRadius: 14,
    gap: 8,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
