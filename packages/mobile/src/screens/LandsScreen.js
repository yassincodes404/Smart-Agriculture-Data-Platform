import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { colors, spacing, radius } from "@agri/shared/theme";
import { getLandStatusColor } from "@agri/shared/status";
import { listLands } from "../api";

export default function LandsScreen({ navigation }) {
  const [lands, setLands] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
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

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={lands}
      keyExtractor={(item) => item.public_id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.green600} />}
      ListHeaderComponent={<Text style={styles.title}>Your Lands</Text>}
      ListEmptyComponent={
        !loading ? <Text style={styles.empty}>No lands registered yet.</Text> : null
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate("LandDetail", { id: item.public_id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={[styles.badge, styles[`badge_${getLandStatusColor(item.status)}`]]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {item.area_hectares || "—"} ha • {item.latitude?.toFixed(3)}°N
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  content: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  title: { fontSize: 22, fontWeight: "700", color: colors.green800, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: spacing.sm },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  badge_healthy: { backgroundColor: colors.green50 },
  badge_warning: { backgroundColor: "#fffbeb" },
  badge_critical: { backgroundColor: "#fef2f2" },
  badge_info: { backgroundColor: "#eff6ff" },
  badgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.xs },
  empty: { color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});