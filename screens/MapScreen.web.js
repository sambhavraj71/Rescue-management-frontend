import { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import { io } from "socket.io-client";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:5000";

const EC = { Fire:"#ef4444", Flood:"#3b82f6", Earthquake:"#f59e0b", Accident:"#f97316", Medical:"#22c55e", "Voice Emergency":"#a855f7" };
const SBG = { pending:"#78350f", assigned:"#0c4a6e", accepted:"#14532d", completed:"#1e293b" };
const SC  = { pending:"#fde68a", assigned:"#bae6fd", accepted:"#bbf7d0", completed:"#94a3b8" };

const esc = (s) => String(s || "").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,'\\"');

function buildRescueHTML(teamName, cases, myLoc) {
  const safe = (s) => esc(s);
  const myM = myLoc ? `
    var myIc=L.divIcon({html:'<div style="width:26px;height:26px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px #22c55e44,0 2px 8px #000a;display:flex;align-items:center;justify-content:center;font-size:13px">🚑</div>',iconSize:[26,26],iconAnchor:[13,13],className:''});
    var myM=L.marker([${myLoc.latitude},${myLoc.longitude}],{icon:myIc,zIndexOffset:1000}).addTo(map)
      .bindPopup('<div style="text-align:center"><b style="color:#22c55e;font-size:14px">🚑 You</b><br/><span style="color:#86efac">${safe(teamName)}</span><br/><span style="color:#64748b;font-size:11px">Rescue Team</span></div>');
  ` : "";

  const markers = cases.map((s) => {
    const color = EC[s.emergencyType] || "#ef4444";
    const victim = safe(s.userId?.name || "Unknown");
    const type   = safe(s.emergencyType || "Emergency");
    const notes  = safe(s.notes || "—");
    const id     = s._id.slice(-6);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}&travelmode=driving`;

    // Route line from rescue to victim
    const routeLine = myLoc ? `
      var rl_${id}=L.polyline([[${myLoc.latitude},${myLoc.longitude}],[${s.latitude},${s.longitude}]],{
        color:'${color}',weight:4,dashArray:'10,7',opacity:0.85
      }).addTo(map);
      // Distance label on line midpoint
      var mid_${id}=[((${myLoc.latitude})+(${s.latitude}))/2,((${myLoc.longitude})+(${s.longitude}))/2];
      var R=6371,dLat=(${s.latitude}-${myLoc.latitude})*Math.PI/180,dLon=(${s.longitude}-${myLoc.longitude})*Math.PI/180;
      var aa=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(${myLoc.latitude}*Math.PI/180)*Math.cos(${s.latitude}*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
      var dist_${id}=(R*2*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa))).toFixed(1);
      L.marker(mid_${id},{icon:L.divIcon({html:'<div style="background:#1e293b;border:1px solid ${color};border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700;color:${color};white-space:nowrap">'+dist_${id}+' km</div>',className:'',iconAnchor:[30,10]})}).addTo(map);
    ` : "";

    return `
      var ic_${id}=L.divIcon({html:'<div style="width:30px;height:30px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px ${color}44,0 2px 8px #000a;display:flex;align-items:center;justify-content:center;font-size:14px">🆘</div>',iconSize:[30,30],iconAnchor:[15,15],className:''});
      L.marker([${s.latitude},${s.longitude}],{icon:ic_${id}}).addTo(map)
        .bindPopup('<div style="min-width:190px">'
          +'<b style="color:${color};font-size:14px">🚨 ${type}</b>'
          +'<br/><span style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:1px">${s.status}</span>'
          +'<hr style="border-color:#334155;margin:6px 0"/>'
          +'<b style="color:#e2e8f0">👤 ${victim}</b>'
          +'<br/><span style="color:#94a3b8;font-size:12px">📝 ${notes}</span>'
          +'<br/><span style="color:#64748b;font-size:11px">📍 ${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}</span>'
          +'<hr style="border-color:#334155;margin:6px 0"/>'
          +'<a href="${mapsUrl}" target="_blank" style="display:block;background:#0369a1;color:#fff;text-align:center;padding:7px;border-radius:7px;font-weight:700;font-size:12px;text-decoration:none">🗺 Open Navigation</a>'
          +'</div>');
      ${routeLine}
    `;
  }).join("\n");

  const center = myLoc
    ? `[${myLoc.latitude},${myLoc.longitude}]`
    : cases.length > 0 ? `[${cases[0].latitude},${cases[0].longitude}]`
    : "[20.5937,78.9629]";

  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%;background:#0f172a}
.leaflet-popup-content-wrapper{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:12px;box-shadow:0 4px 20px #000a}
.leaflet-popup-tip{background:#1e293b}
.leaflet-popup-content{margin:12px 16px;font-size:13px;line-height:1.7}
</style>
</head><body><div id="map"></div><script>
var map=L.map('map',{zoomControl:true}).setView(${center},${cases.length > 0 ? 13 : 5});
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© CARTO',maxZoom:19}).addTo(map);
${myM}${markers}
${cases.length > 0 && myLoc ? `
var allPts=[[${myLoc.latitude},${myLoc.longitude}]${cases.map(s=>`,\n[${s.latitude},${s.longitude}]`).join("")}];
map.fitBounds(allPts,{padding:[40,40]});
` : ""}
</script></body></html>`;
}

function buildUserHTML(userLat, userLng, mySOS, liveLocations) {
  const safe = (s) => esc(s);
  const userM = userLat ? `
    var uIc=L.divIcon({html:'<div style="width:20px;height:20px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px #3b82f644,0 2px 8px #000a"></div>',iconSize:[20,20],iconAnchor:[10,10],className:''});
    L.marker([${userLat},${userLng}],{icon:uIc,zIndexOffset:1000}).addTo(map).bindPopup('<b style="color:#3b82f6">📍 Your Location</b>');
  ` : "";

  const markers = mySOS.map((s) => {
    const color = EC[s.emergencyType] || "#ef4444";
    const team  = safe(s.assignedRescueTeamName || "Not assigned yet");
    const type  = safe(s.emergencyType || "");
    const id    = s._id.slice(-6);
    const live  = liveLocations[s._id];

    const routeLine = (live && userLat) ? `
      L.polyline([[${userLat},${userLng}],[${live.latitude},${live.longitude}]],{color:'#22c55e',weight:3,dashArray:'8,6',opacity:0.8}).addTo(map);
    ` : "";

    const liveM = live ? `
      var liIc_${id}=L.divIcon({html:'<div style="width:22px;height:22px;background:#22c55e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px #22c55e44,0 2px 8px #000a;display:flex;align-items:center;justify-content:center;font-size:11px">🚑</div>',iconSize:[22,22],iconAnchor:[11,11],className:''});
      L.marker([${live.latitude},${live.longitude}],{icon:liIc_${id}}).addTo(map)
        .bindPopup('<b style="color:#22c55e">🚑 LIVE — ${team}</b><br/><span style="color:#86efac;font-size:12px">En route to you</span>');
    ` : "";

    return `
      var ic_${id}=L.divIcon({html:'<div style="width:24px;height:24px;background:${color};border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px ${color}44,0 2px 8px #000a;display:flex;align-items:center;justify-content:center;font-size:11px">🚨</div>',iconSize:[24,24],iconAnchor:[12,12],className:''});
      L.marker([${s.latitude},${s.longitude}],{icon:ic_${id}}).addTo(map)
        .bindPopup('<div style="min-width:160px"><b style="color:${color}">🚨 ${type}</b><br/><span style="color:#94a3b8;font-size:11px">${s.status}</span><br/>🚑 ${team}</div>');
      ${routeLine}${liveM}
    `;
  }).join("\n");

  const center = userLat ? `[${userLat},${userLng}]` : "[20.5937,78.9629]";
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%;background:#0f172a}
.leaflet-popup-content-wrapper{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:12px}
.leaflet-popup-tip{background:#1e293b}
.leaflet-popup-content{margin:12px 16px;font-size:13px;line-height:1.7}
</style>
</head><body><div id="map"></div><script>
var map=L.map('map').setView(${center},14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'© CARTO',maxZoom:19}).addTo(map);
${userM}${markers}
</script></body></html>`;
}

export default function MapScreen({ route }) {
  const [role, setRole]           = useState(route?.params?.role || "user");
  const [userName, setUserName]   = useState(route?.params?.userName || "");
  const [userId, setUserId]       = useState(route?.params?.userId || "");
  const [myLocation, setMyLocation] = useState(null);
  const [mySOS, setMySOS]         = useState([]);
  const [activeCases, setActiveCases] = useState([]);
  const [liveLocations, setLiveLocations] = useState({});
  const [loading, setLoading]     = useState(true);
  const [locStatus, setLocStatus] = useState("Fetching...");
  const socketRef = useRef(null);
  const dataRef   = useRef({ role, userName, userId });

  // Always load from AsyncStorage — route.params not reliable on web
  useEffect(() => {
    AsyncStorage.multiGet(["userId", "userName", "role"]).then((vals) => {
      const uid  = vals[0][1] || userId;
      const name = vals[1][1] || userName;
      const r    = vals[2][1] || role;
      setUserId(uid); setUserName(name); setRole(r);
      dataRef.current = { role: r, userName: name, userId: uid };
    });
  }, []);

  const getLocation = useCallback(() => {
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => { setMyLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setLocStatus("Live"); },
        () => setLocStatus("Unavailable"),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else { setLocStatus("Unavailable"); }
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

  // Re-fetch when role/userName/userId loads from AsyncStorage
  useEffect(() => {
    if (role || userName || userId) {
      dataRef.current = { role, userName, userId };
      fetchData();
    }
  }, [role, userName, userId]);

  useEffect(() => {
    getLocation();
    const interval    = setInterval(fetchData, 10000);
    const locInterval = setInterval(getLocation, 15000);
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("sosUpdated",         fetchData);
    socket.on("sosStatusUpdated",   fetchData);
    socket.on("rescueLocationUpdated", (d) => setLiveLocations((prev) => ({ ...prev, [d.sosId]: d })));
    return () => { clearInterval(interval); clearInterval(locInterval); socket.disconnect(); };
  }, [fetchData, getLocation]);

  const isRescue = role === "rescue" || role === "admin";
  const activeList = isRescue ? activeCases : mySOS;

  const html = isRescue
    ? buildRescueHTML(userName, activeCases, myLocation)
    : buildUserHTML(myLocation?.latitude, myLocation?.longitude, mySOS, liveLocations);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {isRescue ? "🚑 Rescue Operations Map" : "📍 My Live Rescue Map"}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: locStatus === "Live" ? "#22c55e" : "#f59e0b" }]} />
            <Text style={styles.statusTxt}>{locStatus}</Text>
            <Text style={styles.sep}>•</Text>
            <Text style={styles.statusTxt}>
              {isRescue
                ? `${activeCases.length} active mission${activeCases.length !== 1 ? "s" : ""}`
                : `${mySOS.length} SOS tracked`}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { getLocation(); fetchData(); }}>
          <Ionicons name="refresh" size={18} color="#38bdf8" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.loaderTxt}>Loading map...</Text>
          </View>
        ) : (
          <iframe key={html.length} srcDoc={html} style={{ width:"100%", height:"100%", border:"none" }} title="map" />
        )}
      </View>

      {/* Bottom cards */}
      {activeList.length > 0 && (
        <View style={styles.bottom}>
          <Text style={styles.bottomTitle}>
            {isRescue ? "🟢 Active Missions" : "🚨 Active SOS"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {activeList.map((item) => {
              const color = EC[item.emergencyType] || "#ef4444";
              const live  = liveLocations[item._id];
              return (
                <View key={item._id} style={[styles.card, { borderLeftColor: color }]}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardType, { color }]}>{item.emergencyType}</Text>
                    <View style={[styles.pill, { backgroundColor: SBG[item.status] }]}>
                      <Text style={[styles.pillTxt, { color: SC[item.status] }]}>{item.status}</Text>
                    </View>
                  </View>
                  {isRescue
                    ? <Text style={styles.cardSub}>👤 {item.userId?.name || "Unknown"}</Text>
                    : <Text style={styles.cardSub}>🚑 {item.assignedRescueTeamName || "Awaiting team"}</Text>}
                  <Text style={styles.cardCoord}>📍 {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}</Text>
                  {isRescue && myLocation && (
                    <TouchableOpacity
                      style={styles.navBtn}
                      onPress={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}&travelmode=driving`, "_blank")}
                    >
                      <Ionicons name="navigate" size={11} color="#fff" />
                      <Text style={styles.navTxt}>Navigate</Text>
                    </TouchableOpacity>
                  )}
                  {live && (
                    <View style={styles.liveRow}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveTxt}>
                        {isRescue ? "Live tracking active" : "Team live on map"}
                      </Text>
                    </View>
                  )}
                  {isRescue && myLocation && (
                    <Text style={styles.distTxt}>
                      {(() => {
                        const R=6371, dLat=(item.latitude-myLocation.latitude)*Math.PI/180, dLon=(item.longitude-myLocation.longitude)*Math.PI/180;
                        const a=Math.sin(dLat/2)**2+Math.cos(myLocation.latitude*Math.PI/180)*Math.cos(item.latitude*Math.PI/180)*Math.sin(dLon/2)**2;
                        const km=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
                        return km<1?`${Math.round(km*1000)}m away`:`${km.toFixed(1)}km away`;
                      })()}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!loading && activeList.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name={isRescue ? "shield-checkmark" : "checkmark-circle"} size={22} color="#22c55e" />
          <Text style={styles.emptyTxt}>
            {isRescue ? "No active missions" : "No active SOS — You are safe"}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex:1, backgroundColor:"#0f172a" },
  header: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:16, paddingVertical:12, backgroundColor:"#1e293b", borderBottomWidth:1, borderBottomColor:"#334155" },
  headerTitle: { fontSize:16, fontWeight:"800", color:"#fff", marginBottom:4 },
  statusRow: { flexDirection:"row", alignItems:"center", gap:6 },
  dot: { width:7, height:7, borderRadius:4 },
  statusTxt: { fontSize:11, color:"#94a3b8", fontWeight:"600" },
  sep: { color:"#334155", fontSize:11 },
  refreshBtn: { backgroundColor:"#0f172a", borderWidth:1, borderColor:"#334155", borderRadius:10, padding:8 },
  mapWrap: { flex:1 },
  loader: { flex:1, justifyContent:"center", alignItems:"center", gap:12, backgroundColor:"#0f172a" },
  loaderTxt: { color:"#94a3b8", fontSize:14 },
  bottom: { backgroundColor:"#1e293b", borderTopWidth:1, borderTopColor:"#334155", paddingVertical:12, paddingHorizontal:16 },
  bottomTitle: { fontSize:11, color:"#94a3b8", fontWeight:"700", textTransform:"uppercase", letterSpacing:1, marginBottom:10 },
  card: { backgroundColor:"#0f172a", borderRadius:12, padding:12, marginRight:10, minWidth:190, borderLeftWidth:3, borderWidth:1, borderColor:"#334155" },
  cardTop: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:6 },
  cardType: { fontSize:13, fontWeight:"800" },
  pill: { paddingHorizontal:8, paddingVertical:2, borderRadius:999 },
  pillTxt: { fontSize:10, fontWeight:"700" },
  cardSub: { fontSize:12, color:"#cbd5e1", marginBottom:3 },
  cardCoord: { fontSize:11, color:"#64748b", marginBottom:4 },
  navBtn: { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:"#0369a1", borderRadius:7, paddingHorizontal:10, paddingVertical:6, marginBottom:6, alignSelf:"flex-start" },
  navTxt: { color:"#fff", fontSize:11, fontWeight:"700" },
  liveRow: { flexDirection:"row", alignItems:"center", gap:5, marginTop:4 },
  liveDot: { width:6, height:6, borderRadius:3, backgroundColor:"#22c55e" },
  liveTxt: { fontSize:10, color:"#22c55e", fontWeight:"600" },
  distTxt: { fontSize:11, color:"#a78bfa", fontWeight:"600", marginTop:4 },
  empty: { flexDirection:"row", alignItems:"center", gap:10, backgroundColor:"#1e293b", borderTopWidth:1, borderTopColor:"#334155", padding:14 },
  emptyTxt: { color:"#94a3b8", fontSize:13, fontWeight:"600" },
});
