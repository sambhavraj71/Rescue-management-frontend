import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import API from "../services/api";

const STATUS_COLORS = {
  pending: "#f59e0b",
  assigned: "#38bdf8",
  accepted: "#22c55e",
  completed: "#10b981",
};

const typeIconMap = {
  Flood: "water",
  Fire: "flame",
  Earthquake: "earth",
  Accident: "car",
  Medical: "medkit",
  "Voice Emergency": "mic",
};

const formatRelative = (isoDate) => {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day ago`;
};

export default function AlertsScreen({ route }) {
  const [userId, setUserId] = useState(route?.params?.userId || null);

  useEffect(() => {
    if (!userId) {
      AsyncStorage.getItem("userId").then((id) => {
        if (id) setUserId(id);
      });
    }
  }, []);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = useCallback(async (silent = false) => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      if (!silent) {
        setLoading(true);
      }

      const response = await API.get(`/sos/user/${userId}`);
      setItems(response.data || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadStatus(true);
    }, 12000);

    return () => clearInterval(interval);
  }, [loadStatus]);

  const activeCount = useMemo(
    () => items.filter((item) => item.status !== "completed").length,
    [items]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>RescueApp</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => {
            setRefreshing(true);
            loadStatus(true);
          }}
        >
          <Ionicons name="refresh" size={18} color="#38bdf8" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.analyticsBar}>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>{items.length}</Text>
          <Text style={styles.analyticsLabel}>Total SOS</Text>
        </View>
        <View style={styles.analyticsCard}>
          <Text style={styles.analyticsNumber}>{activeCount}</Text>
          <Text style={styles.analyticsLabel}>Active Cases</Text>
        </View>
      </View>

      <Text style={styles.pageTitle}>Family Tracking & Live Rescue Status</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#ef4444" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStatus(true)} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="radio-outline" size={34} color="#64748b" />
              <Text style={styles.emptyText}>No SOS yet. Send emergency from SOS panel.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const color = STATUS_COLORS[item.status] || "#f59e0b";
            const icon = typeIconMap[item.emergencyType] || "warning";
            const lastUpdate = item.statusHistory?.[item.statusHistory.length - 1];

            return (
              <View style={styles.alertCard}>
                <View style={[styles.iconBox, { backgroundColor: `${color}22` }]}>
                  <Ionicons name={icon} size={23} color={color} />
                </View>

                <View style={styles.alertInfo}>
                  <Text style={styles.alertType}>{item.emergencyType}</Text>
                  <Text style={styles.alertLocation}>
                    <Ionicons name="location-outline" size={12} color="#94a3b8" /> {item.latitude?.toFixed(4)},{" "}
                    {item.longitude?.toFixed(4)}
                  </Text>
                  {item.assignedRescueTeamName ? (
                    <Text style={styles.metaText}>Rescue Team: {item.assignedRescueTeamName}</Text>
                  ) : null}
                  {lastUpdate?.note ? <Text style={styles.metaText}>Note: {lastUpdate.note}</Text> : null}
                </View>

                <View style={styles.alertMeta}>
                  <Text style={styles.alertTime}>{formatRelative(item.updatedAt)}</Text>
                  <View style={[styles.badge, { backgroundColor: `${color}33` }]}>
                    <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
                  </View>
                </View>

                {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.imageThumb} /> : null}
              </View>
            );
          }}
        />
      )}
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
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshText: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "700",
  },
  analyticsBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 14,
  },
  analyticsCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
  },
  analyticsNumber: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  analyticsLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
  pageTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 20,
    marginTop: 15,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 30,
  },
  alertCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 13,
    gap: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  alertInfo: {
    gap: 4,
  },
  alertType: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "700",
  },
  alertLocation: {
    color: "#94a3b8",
    fontSize: 12,
  },
  metaText: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  alertMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  alertTime: {
    color: "#64748b",
    fontSize: 11,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  imageThumb: {
    width: "100%",
    height: 130,
    borderRadius: 10,
  },
  emptyWrap: {
    alignItems: "center",
    marginTop: 60,
    gap: 8,
  },
  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
    maxWidth: 260,
  },
});
