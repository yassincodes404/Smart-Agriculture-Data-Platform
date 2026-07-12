import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, radius, layout } from "@agri/shared/theme";
import { useAuth } from "../context/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user?.email?.charAt(0).toUpperCase() || "?"}
        </Text>
      </View>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>{user?.role || "viewer"}</Text>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    padding: spacing.xl,
    paddingTop: spacing["2xl"],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.green600,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: "#fff" },
  email: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  role: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, textTransform: "capitalize" },
  logoutBtn: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    minHeight: layout.touchTarget,
    justifyContent: "center",
  },
  logoutText: { color: colors.error, fontWeight: "600", fontSize: 15 },
});