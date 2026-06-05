import { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, StatusBar, ActivityIndicator,
  TouchableOpacity, Platform, ScrollView, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "https://rescue-management-backend.onrender.com";

const EMERGENCY_COLORS = {
  Fire: "#ef4444", Flood: "#3b82f6", Earthquake: "#f59e0b",
  Accident: "#f97316", Medical: "#22c55e", "Voice Emergency": "#a855f7",
};
const STATUS_BG = {
  pending: "#78350f", assigned: "#0c4a6e", accepted: "#14532d", completed: "#1e293b",
};
const STATUS_COLOR = {
  pending: "#fde68a", assigned: "#bae6fd", accepted: "#bbf7d0", completed: "#94a3b8",
};

function buildUserMapHTML(userLat, userLng, mySOS, liveLocations) {
  const userMarker = userLat ? `
    var userIcon = L.divIcon({
      html: '<div style="width:18px;height:18px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px #3b82f6aa"></div>',
      iconSize:[18,18], iconAnchor:[9,9], className:''
    });
    L.marker([${userLat},${userLng}], {icon:userIcon}).addTo(map)
      .bindPopup('<b style="color:#3b82f6">Your Location</b>');
  ` : "";

  const sosMarkers = mySOS.map((sos) => {
    const color = EMERGENCY_COLORS[sos.emergencyType] || "#ef4444";
    const team = (sos.assignedRescueTeamName || "").replace(/[^a-zA-Z0-9 ]/g, "");
    const teamDisplay = team || "Not assigned yet";
    const type = (sos.emergencyType || "").replace(/[^a-zA-Z0-9 ]/g, "");
    const live = liveLocations[sos._id];

    // Distance calculation between two coords (km)
    const distJS = (userLat && live) ? `
      function calcDist_${sos._id.slice(-5)}(lat1,lon1,lat2,lon2){
        var R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
        var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
        return (R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(1);
      }
      var dist_${sos._id.slice(-5)} = calcDist_${sos._id.slice(-5)}(${userLat},${userLng},${live.latitude},${live.longitude});
    ` : "";

    const line = (live && userLat)
      ? `L.polyline([[${userLat},${userLng}],[${live.latitude},${live.longitude}]],{color:'#22c55e',weight:2,dashArray:'6,5',opacity:0.7}).addTo(map);`
      : "";

    const liveMarker = live ? `
      ${distJS}
      var li_${sos._id.slice(-5)} = L.divIcon({
        html: '<div style="width:20px;height:20px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px #22c55e"></div>',
        iconSize:[20,20],iconAnchor:[10,10],className:''
      });
      L.marker([${live.latitude},${live.longitude}],{icon:li_${sos._id.slice(-5)}}).addTo(map)
        .bindPopup(
          '<div style="min-width:160px">'
          + '<b style="color:#22c55e">LIVE - ${teamDisplay}</b>'
          + '<br/><span style="color:#94a3b8;font-size:11px">Rescue team en route</span>'
          + (typeof dist_${sos._id.slice(-5)} !== 'undefined' ? '<br/><span style="color:#38bdf8;font-weight:bold">' + dist_${sos._id.slice(-5)} + ' km away from you</span>' : '')
          + '</div>'
        );
    ` : "";

    // SOS popup content
    const teamStatus = live
      ? `'<br/><span style="color:#22c55e;font-weight:bold">Team Connected - En Route</span>'`
      : team
      ? `'<br/><span style="color:#f59e0b">Team Assigned - Awaiting dispatch</span>'`
      : `'<br/><span style="color:#ef4444">No team assigned yet</span>'`;

    return `
      var ic_${sos._id.slice(-5)} = L.divIcon({
        html: '<div style="width:22px;height:22px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px ${color}88"></div>',
        iconSize:[22,22],iconAnchor:[11,11],className:''
      });
      L.marker([${sos.latitude},${sos.longitude}],{icon:ic_${sos._id.slice(-5)}}).addTo(map)
        .bindPopup(
          '<div style="min-width:160px">'
          + '<b style="color:${color}">${type}</b>'
          + '<br/><span style="color:#94a3b8;font-size:11px">Status: ${sos.status}</span>'
          + '<br/>Team: <b>${teamDisplay}</b>'
          + ${teamStatus}
          + '</div>'
        );
      ${line}
      ${liveMarker}
    `;
  }).join("\n");

  const center = userLat ? `[${userLat},${userLng}]` : "[27.09,84.46]";
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}
.leaflet-popup-content-wrapper{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:10px}
.leaflet-popup-tip{background:#1e293b}
.leaflet-popup-content{margin:10px 14px;font-size:13px;line-height:1.8}
</style>
</head><body><div id="map"></div>
<script>
var map=L.map('map').setView(${center},14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM',maxZoom:19}).addTo(map);
${userMarker}${sosMarkers}
</script></body></html>`;
}

function buildRescueMapHTML(activeCases, myLocation, liveLocations) {
  const myMarker = myLocation ? `
    var myIcon = L.divIcon({html:'<div style="width:22px;height:22px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 14px #22c55eaa"></div>',iconSize:[22,22],iconAnchor:[11,11],className:''});
    L.marker([${myLocation.latitude},${myLocation.longitude}],{icon:myIcon}).addTo(map)
      .bindPopup('<b style="color:#22c55e">Your Location</b>');
  ` : "";

  const caseMarkers = activeCases.map((sos) => {
    const color = EMERGENCY_COLORS[sos.emergencyType] || "#ef4444";
    const victim = (sos.userId?.name || "Unknown").replace(/[^a-zA-Z0-9 ]/g, "");
    const type = (sos.emergencyType || "").replace(/[^a-zA-Z0-9 ]/g, "");
    const from = myLocation;
    const line = from
      ? `L.polyline([[${from.latitude},${from.longitude}],[${sos.latitude},${sos.longitude}]],{color:'${color}',weight:3,dashArray:'8,6',opacity:0.8}).addTo(map);`
      : "";
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${sos.latitude},${sos.longitude}&travelmode=driving`;
    return `
      var ci_${sos._id.slice(-5)} = L.divIcon({html:'<div style="width:26px;height:26px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 0 16px ${color}99"></div>',iconSize:[26,26],iconAnchor:[13,13],className:''});
      L.marker([${sos.latitude},${sos.longitude}],{icon:ci_${sos._id.slice(-5)}}).addTo(map)
        .bindPopup(
          '<div style="min-width:150px">'
          + '<b style="color:${color}">${type}</b>'
          + '<br/>Victim: ${victim}'
          + '<br/><span style="color:#94a3b8;font-size:11px">${sos.status}</span>'
          + '<br/><button onclick="navigate_${sos._id.slice(-5)}()" style="margin-top:6px;width:100%;background:#0369a1;color:#fff;border:none;border-radius:6px;padding:6px 0;font-size:12px;font-weight:bold;cursor:pointer">Navigate</button>'
          + '</div>'
        );
      function navigate_${sos._id.slice(-5)}() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage('nav:${sos.latitude},${sos.longitude}');
        } else {
          window.open('${mapsUrl}', '_blank');
        }
      }
      ${line}
    `;
  }).join("\n");

  const center = myLocation
    ? `[${myLocation.latitude},${myLocation.longitude}]`
    : activeCases.length > 0
    ? `[${activeCases[0].latitude},${activeCases[0].longitude}]`
    : "[27.09,84.46]";

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}
.leaflet-popup-content-wrapper{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:10px}
.leaflet-popup-tip{background:#1e293b}
.leaflet-popup-content{margin:10px 14px;font-size:13px;line-height:1.8}
</style>
</head><body><div id="map"></div>
<script>
var map=L.map('map').setView(${center},13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'OSM',maxZoom:19}).addTo(map);
${myMarker}${caseMarkers}
</script></body></html>`;
}

let WebView = null;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

export default function MapScreen({ route }) {
  const role = route?.params?.role || "user";
  const userName = route?.params?.userName || "";
  const userId = route?.params?.userId || "";
  const isRescue = role === "rescue" || role === "admin";

  const [myLocation, setMyLocation] = useState(null);
  const [mySOS, setMySOS] = useState([]);
  const [activeCases, setActiveCases] = useState([]);
  const [liveLocations, setLiveLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [locStatus, setLocStatus] = useState("Fetching...");
  const socketRef = useRef(null);

  // Load from AsyncStorage to handle reload without route params
  const [resolvedRole, setResolvedRole] = useState(route?.params?.role || "");
  const [resolvedName, setResolvedName] = useState(route?.params?.userName || "");
  const [resolvedId, setResolvedId]     = useState(route?.params?.userId || "");
  const dataRef = useRef({ role: resolvedRole, userName: resolvedName, userId: resolvedId });

  useEffect(() => {
    AsyncStorage.multiGet(["userId","userName","role"]).then((vals) => {
      const uid  = vals[0][1] || userId;
      const name = vals[1][1] || userName;
      const r    = vals[2][1] || role;
      setResolvedId(uid); setResolvedName(name); setResolvedRole(r);
      dataRef.current = { role: r, userName: name, userId: uid };
    });
  }, []);

  const isRescueResolved = resolvedRole === "rescue" || resolvedRole === "admin";

  const getLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocStatus("Permission denied"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocStatus("Live");
    } catch {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) { setMyLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude }); setLocStatus("Last known"); }
      } catch { setLocStatus("Unavailable"); }
    }
  }, []);

  const fetchData = useCallback(async () => {
    const { role: r, userName: name, userId: uid } = dataRef.current;
    try {
      const isR = r === "rescue" || r === "admin";
      if (isR && name) {
        const res = await API.get(`/rescue/my-active/${encodeURIComponent(name)}`);
        setActiveCases((res.data || []).filter((s) => s.status !== "completed"));
      } else if (!isR && uid) {
        const res = await API.get(`/sos/user/${uid}`);
        setMySOS((res.data || []).filter((s) => s.status !== "completed"));
      }
    } catch (e) { console.log(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (resolvedRole || resolvedName || resolvedId) {
      dataRef.current = { role: resolvedRole, userName: resolvedName, userId: resolvedId };
      fetchData();
    }
  }, [resolvedRole, resolvedName, resolvedId]);

  useEffect(() => {
    getLocation();
    fetchData();
    const interval = setInterval(fetchData, 10000);
    const locInt = setInterval(getLocation, 15000);
    try {
      const { io } = require("socket.io-client");
      const socket = io(SOCKET_URL, { transports: ["websocket"] });
      socketRef.current = socket;
      socket.on("sosUpdated", fetchData);
      socket.on("sosStatusUpdated", fetchData);
      socket.on("rescueLocationUpdated", (d) => setLiveLocations((p) => ({ ...p, [d.sosId]: d })));
    } catch (e) { console.log("Socket:", e); }
    return () => {
      clearInterval(interval);
      clearInterval(locInt);
      socketRef.current?.disconnect();
    };
  }, [fetchData, getLocation]);

  // Handle postMessage from WebView (Navigate button)
  const handleWebViewMessage = (event) => {
    const msg = event.nativeEvent.data;
    if (msg.startsWith("nav:")) {
      const [lat, lng] = msg.replace("nav:", "").split(",");
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`);
    }
  };

  const html = isRescueResolved
    ? buildRescueMapHTML(activeCases, myLocation, liveLocations)
    : buildUserMapHTML(myLocation?.latitude, myLocation?.longitude, mySOS, liveLocations);

  const activeList = isRescueResolved ? activeCases : mySOS;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {isRescue ? "🚑 Rescue Operations Map" : "📍 My Live Rescue Map"}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: locStatus === "Live" ? "#22c55e" : "#f59e0b" }]} />
            <Text style={styles.statusText}>{locStatus}</Text>
            <Text style={styles.sep}>•</Text>
            <Text style={styles.statusText}>
              {isRescueResolved ? `${activeCases.length} mission${activeCases.length !== 1 ? "s" : ""}` : `${mySOS.length} SOS active`}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { getLocation(); fetchData(); }}>
          <Ionicons name="refresh" size={18} color="#38bdf8" />
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.loaderText}>Loading map...</Text>
          </View>
        ) : Platform.OS !== "web" && WebView ? (
          <WebView
            source={{ html }}
            style={{ flex: 1 }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            mixedContentMode="always"
            onMessage={handleWebViewMessage}
          />
        ) : (
          <iframe srcDoc={html} style={{ width: "100%", height: "100%", border: "none" }} title="map" />
        )}
      </View>

      {activeList.length > 0 && (
        <View style={styles.bottomPanel}>
          <Text style={styles.bottomTitle}>
            {isRescueResolved ? "🟢 Active Missions" : "🚨 Active SOS"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {activeList.map((item) => {
              const color = EMERGENCY_COLORS[item.emergencyType] || "#ef4444";
              const live = liveLocations[item._id];
              return (
                <View key={item._id} style={[styles.infoCard, { borderLeftColor: color }]}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardType, { color }]}>{item.emergencyType}</Text>
                    <View style={[styles.pill, { backgroundColor: STATUS_BG[item.status] }]}>
                      <Text style={[styles.pillText, { color: STATUS_COLOR[item.status] }]}>{item.status}</Text>
                    </View>
                  </View>
                  {isRescueResolved
                    ? <Text style={styles.cardSub}>👤 {item.userId?.name || "Unknown"}</Text>
                    : <Text style={styles.cardSub}>🚑 {item.assignedRescueTeamName || "Awaiting team assignment"}</Text>}
                  <Text style={styles.cardCoord}>📍 {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}</Text>
                  {/* User side: team connection status */}
                  {!isRescueResolved && (
                    <View style={[styles.teamStatusRow, { backgroundColor: live ? "#14532d" : item.assignedRescueTeamName ? "#0c4a6e" : "#450a0a" }]}>
                      <View style={[styles.liveDot, { backgroundColor: live ? "#22c55e" : item.assignedRescueTeamName ? "#38bdf8" : "#ef4444" }]} />
                      <Text style={[styles.teamStatusText, { color: live ? "#bbf7d0" : item.assignedRescueTeamName ? "#bae6fd" : "#fca5a5" }]}>
                        {live ? "Team connected & en route" : item.assignedRescueTeamName ? "Team assigned" : "No team yet"}
                      </Text>
                    </View>
                  )}
                  {isRescueResolved && (
                    <TouchableOpacity
                      style={styles.navBtn}
                      onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}&travelmode=driving`)}
                    >
                      <Ionicons name="navigate" size={12} color="#fff" />
                      <Text style={styles.navText}>Navigate</Text>
                    </TouchableOpacity>
                  )}
                  {live && (
                    <View style={styles.liveRow}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>{isRescueResolved ? "Live tracking active" : "Team live location visible on map"}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!loading && activeList.length === 0 && (
        <View style={styles.emptyPanel}>
          <Ionicons name={isRescue ? "shield-checkmark" : "checkmark-circle"} size={24} color="#22c55e" />
          <Text style={styles.emptyText}>
            {isRescue ? "No active missions" : "No active SOS — You are safe"}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#1e293b", borderBottomWidth: 1, borderBottomColor: "#334155",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  sep: { color: "#334155", fontSize: 11 },
  refreshBtn: { backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155", borderRadius: 10, padding: 8 },
  mapContainer: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, backgroundColor: "#0f172a" },
  loaderText: { color: "#94a3b8", fontSize: 14 },
  bottomPanel: {
    backgroundColor: "#1e293b", borderTopWidth: 1, borderTopColor: "#334155",
    paddingVertical: 12, paddingHorizontal: 16,
  },
  bottomTitle: { fontSize: 11, color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  infoCard: {
    backgroundColor: "#0f172a", borderRadius: 12, padding: 12,
    marginRight: 10, minWidth: 190, borderLeftWidth: 3, borderWidth: 1, borderColor: "#334155",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardType: { fontSize: 13, fontWeight: "800" },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: "700" },
  cardSub: { fontSize: 12, color: "#cbd5e1", marginBottom: 3 },
  cardCoord: { fontSize: 11, color: "#64748b", marginBottom: 6 },
  navBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#0369a1", borderRadius: 7,
    paddingHorizontal: 10, paddingVertical: 6, marginTop: 4, alignSelf: "flex-start",
  },
  navText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  liveText: { fontSize: 10, color: "#22c55e", fontWeight: "600" },
  teamStatusRow: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  teamStatusText: { fontSize: 11, fontWeight: "700" },
  emptyPanel: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#1e293b", borderTopWidth: 1, borderTopColor: "#334155", padding: 14,
  },
  emptyText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
});
