import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

export default function HomeScreen({ navigation, route }) {

  const userId = route?.params?.userId;

  return (
    <View style={styles.container}>

      {/* Header Card */}
      <View style={styles.card}>
        <Text style={styles.title}>🚨 Rescue Dashboard</Text>

        <Text style={styles.subtitle}>
          Welcome to Emergency Control Panel
        </Text>

        {userId && (
          <Text style={styles.userText}>
            User ID: {userId}
          </Text>
        )}
      </View>

      {/* SOS Button */}
      <TouchableOpacity
        style={styles.sosButton}
        onPress={() =>
          navigation.navigate("SOS", { userId })
        }
      >
        <Text style={styles.sosText}>SEND SOS ALERT</Text>
      </TouchableOpacity>

      {/* Secondary Actions */}
      <View style={styles.actions}>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() =>
            navigation.navigate("SOS", { userId })
          }
        >
          <Text style={styles.secondaryText}>Open SOS Panel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: "#444" }]}
          onPress={async () => {
            await AsyncStorage.removeItem("token");
            navigation.replace("Login");
          }}
        >
          <Text style={styles.secondaryText}>Logout</Text>
        </TouchableOpacity>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 20
  },

  card: {
    width: "100%",
    backgroundColor: "#1e293b",
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
    elevation: 10
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8
  },

  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 10
  },

  userText: {
    fontSize: 12,
    color: "#38bdf8"
  },

  sosButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 50,
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
    shadowColor: "#ef4444",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8
  },

  sosText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1
  },

  actions: {
    width: "100%",
    marginTop: 10
  },

  secondaryBtn: {
    backgroundColor: "#2563eb",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center"
  },

  secondaryText: {
    color: "#fff",
    fontWeight: "600"
  }

});