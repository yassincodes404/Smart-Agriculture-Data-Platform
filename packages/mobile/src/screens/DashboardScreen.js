import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { colors, spacing, radius } from "@agri/shared/theme";
import { getLandStatusColor } from "@agri/shared/status";
import { listLands, healthCheck } from "../api";
import { useAuth } from "../context/AuthContext";

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [lands, setLands] = useState([]);
  const [backendOk, setBackendOk] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      healthCheck().then(() => setBackendOk(true)).catch(() => setBackendOk(false));
      const res = await listLands();
      setLands(res.lands || []);
    } catch {
      setLands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalArea = lands.reduce((s, l) => s + (l.area_hectares || 0), 0);
  const activeCount = lands.filter((l) => l.status === "ready" || l.status === "active").length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.green600} />}
    >
      <Text style={styles.greeting}>
        Welcome, {user?.email?.split("@")[0] || "Farmer"} 👋
      </Text>
      <Text style={styles.subtitle}>
        {backendOk === false ? "Backend offline" : `${lands.length} registered lands`}
      </Text>

      <View style={styles.statsRow}>
        <StatCard label="Lands" value={String(lands.length)} color={colors.green600} />
        <StatCard label="Hectares" value={totalArea.toFixed(1)} color={colors.info} />
        <StatCard label="Active" value={`${activeCount}/${lands.length}`} color={colors.amber500} />
      </View>

      <Text style={styles.sectionTitle}>Recent Lands</Text>
      {lands.length === 0 ? (
        <Text style={styles.empty}>No lands yet. Tap Lands tab to explore.</Text>
      ) : (
        lands.slice(0, 5).map((land) => (
          <TouchableOpacity
            key={land.public_id}
            style={styles.landCard}
            onPress={() => navigation.navigate("LandDetail", { id: land.public_id })}
          >
            <Text style={styles.landName}>{land.name}</Text>
            <Text style={styles.landMeta}>
              {land.area_hectares || "—"} ha • {getLandStatusColor(land.status)}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  content: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  greeting: { fontSize: 22, fontWeight: "700", color: colors.green800 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 22, fontWeight: "700" },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, textTransform: "uppercase" },
  sectionTitle: { fontSize: 17, fontWeight: "600", marginBottom: spacing.md },
  landCard: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  landName: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
  landMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  empty: { color: colors.textSecondary, fontSize: 14 },
});