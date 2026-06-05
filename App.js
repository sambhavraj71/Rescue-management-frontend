import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import API from "./services/api";

import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import SOSScreen from "./screens/SOSScreen";
import MapScreen from "./screens/MapScreen";
import AlertsScreen from "./screens/AlertsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RescueScreen from "./screens/RescueScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: "home",
  Map: "map",
  Alerts: "notifications",
  Rescue: "shield-checkmark",
  Profile: "person",
};

function MainTabs({ route }) {
  const { userId, userName, role } = route.params || {};
  const isRescue = role === "rescue" || role === "admin";

  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[tabRoute.name]} size={size} color={color} />
        ),
        tabBarActiveTintColor: "#ef4444",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "#1e293b",
          paddingBottom: 5,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} initialParams={{ userId, userName }} />
      <Tab.Screen name="Map" component={MapScreen} initialParams={{ userId, userName, role }} />
      <Tab.Screen name="Alerts" component={AlertsScreen} initialParams={{ userId, userName }} />
      {isRescue && (
        <Tab.Screen name="Rescue" component={RescueScreen} initialParams={{ userId, userName }} />
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} initialParams={{ userId, userName, role }} />
    </Tab.Navigator>
  );
}

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>Something went wrong</Text>
          <Text style={eb.msg}>{this.state.error?.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center", padding: 20 },
  title: { color: "#ef4444", fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  msg: { color: "#94a3b8", fontSize: 13, textAlign: "center" },
});

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [initialParams, setInitialParams] = useState({});

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const [token, userId, userName, role] = await AsyncStorage.multiGet([
          "token", "userId", "userName", "role",
        ]);

        const hasToken = token[1] && token[1].length > 0;
        const hasUserId = userId[1] && userId[1].length > 0;

        if (hasToken && hasUserId) {
          setInitialParams({
            userId: userId[1],
            userName: userName[1] || "User",
            role: role[1] || "user",
          });
          setInitialRoute("Main");
          registerPushToken(userId[1]);
        } else {
          setInitialRoute("Login");
        }
      } catch {
        setInitialRoute("Login");
      }
    };

    checkAuth();
  }, []);

  const registerPushToken = async (_userId) => {
    // Push notifications via Expo Go SDK 53+ supported nahi — in-app socket notifications use ho rahi hain
  };

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#ef4444" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="Main"
            component={MainTabs}
            initialParams={initialParams}
          />
          <Stack.Screen name="SOS" component={SOSScreen} />
        </Stack.Navigator>
        </NavigationContainer>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
