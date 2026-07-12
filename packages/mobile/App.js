import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors } from "@agri/shared/theme";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import LandsScreen from "./src/screens/LandsScreen";
import LandDetailScreen from "./src/screens/LandDetailScreen";
import CompareScreen from "./src/screens/CompareScreen";
import AddLandScreen from "./src/screens/AddLandScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabScreenOptions = {
  headerStyle: { backgroundColor: colors.green950 },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "600" },
  tabBarActiveTintColor: colors.green600,
  tabBarInactiveTintColor: colors.gray500,
  tabBarStyle: {
    borderTopColor: colors.border,
    paddingBottom: 4,
    height: 60,
  },
};

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Home" }} />
      <Tab.Screen name="Lands" component={LandsScreen} options={{ title: "Lands" }} />
      <Tab.Screen
        name="AddLand"
        component={AddLandScreen}
        options={{ title: "Add Land", tabBarLabel: "Add" }}
      />
      <Tab.Screen name="Compare" component={CompareScreen} options={{ title: "Compare" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bgSecondary }}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="LandDetail"
            component={LandDetailScreen}
            options={{
              title: "Land Intelligence",
              headerStyle: { backgroundColor: colors.green950 },
              headerTintColor: "#fff",
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}