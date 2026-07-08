import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { colors, spacing, radius } from "@agri/shared/theme";
import { listLands } from "../api";
import { fetchLandDetailBundle, computeLandDetailDerived } from "@agri/shared/landDetail";
import { api } from "../api";
export default function CompareScreen() {
  const [lands, setLands] = useState([]);
  const [landAId, setLandAId] = useState(null);
  const [landBId, setLandBId] = useState(null);
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  const loadLands = async () => {
    setLoading(true);
    try {
      const res = await listLands();
      const valid = (res.lands || []).filter((l) => {
        const s = (l.status || "").toLowerCase();
        return s === "ready" || s === "active" || s === "completed";
      });
      setLands(valid);
      if (valid.length > 0 && !landAId) setLandAId(valid[0].public_id);
      if (valid.length > 1 && !landBId) setLandBId(valid[1].public_id);
    } catch {
      setLands([]);
    } finally {
      setLoading(false);
    }
  };

  const loadComparison = async () => {
    if (!landAId || !landBId) return;
    setComparing(true);
    try {
      const [bundleA, bundleB] = await Promise.all([
        fetchLandDetailBundle(landAId, api),
        fetchLandDetailBundle(landBId, api),
      ]);
      setDataA({ ...bundleA, derived: computeLandDetailDerived(bundleA) });
      setDataB({ ...bundleB, derived: computeLandDetailDerived(bundleB) });
    } catch {
      setDataA(null);
      setDataB(null);
    } finally {
      setComparing(false);
    }
  };

  useEffect(() => {
    loadLands();
  }, []);

  useEffect(() => {
    if (landAId && landBId) loadComparison();
  }, [landAId, landBId]);

  const LandPicker = ({ label, selectedId, onSelect, excludeId }) => (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {lands
          .filter((l) => l.public_id !== excludeId)
          .map((l) => (
            <TouchableOpacity
              key={l.public_id}
              style={[styles.chip, selectedId === l.public_id && styles.chipActive]}
              onPress={() => onSelect(l.public_id)}
            >
              <Text style={[styles.chipText, selectedId === l.public_id && styles.chipTextActive]}>
                {l.name}
              </Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  );

  const CompareRow = ({ label, valueA, valueB }) => (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <View style={styles.compareValues}>
        <Text style={styles.compareValue}>{valueA ?? "—"}</Text>
        <Text style={styles.compareDivider}>vs</Text>
        <Text style={styles.compareValue}>{valueB ?? "—"}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green600} />
      </View>
    );
  }

  if (lands.length < 2) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Need at least 2 ready lands</Text>
        <Text style={styles.emptyBody}>Register and process more lands to compare.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={comparing} onRefresh={loadComparison} tintColor={colors.green600} />}
    >
      <Text style={styles.title}>Compare Lands</Text>

      <LandPicker label="Land A" selectedId={landAId} onSelect={setLandAId} excludeId={landBId} />
      <LandPicker label="Land B" selectedId={landBId} onSelect={setLandBId} excludeId={landAId} />

      {comparing ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.green600} />
      ) : dataA && dataB ? (
        <View style={styles.compareCard}>
          <Text style={styles.landNames}>
            {dataA.land.name} vs {dataB.land.name}
          </Text>
          <CompareRow
            label="Area (ha)"
            valueA={dataA.land.area_hectares?.toFixed(1)}
            valueB={dataB.land.area_hectares?.toFixed(1)}
          />
          <CompareRow
            label="NDVI"
            valueA={dataA.derived.latestCrop?.value?.toFixed(2)}
            valueB={dataB.derived.latestCrop?.value?.toFixed(2)}
          />
          <CompareRow
            label="Temperature"
            valueA={dataA.derived.latestClimate ? `${dataA.derived.latestClimate.value}°C` : "—"}
            valueB={dataB.derived.latestClimate ? `${dataB.derived.latestClimate.value}°C` : "—"}
          />
          <CompareRow
            label="Soil Moisture"
            valueA={dataA.derived.latestSoil ? `${dataA.derived.latestSoil.value}%` : "—"}
            valueB={dataB.derived.latestSoil ? `${dataB.derived.latestSoil.value}%` : "—"}
          />
          <CompareRow
            label="Crop Health"
            valueA={dataA.cropHealth?.health_score != null ? `${dataA.cropHealth.health_score}/100` : "—"}
            valueB={dataB.cropHealth?.health_score != null ? `${dataB.cropHealth.health_score}/100` : "—"}
          />
          <CompareRow
            label="AI Insights"
            valueA={String(dataA.aiInsights?.length || 0)}
            valueB={String(dataB.aiInsights?.length || 0)}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  content: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  title: { fontSize: 22, fontWeight: "700", color: colors.green800, marginBottom: spacing.lg },
  pickerBlock: { marginBottom: spacing.md },
  pickerLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.green600, borderColor: colors.green600 },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  chipTextActive: { color: "#fff" },
  compareCard: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  landNames: { fontSize: 16, fontWeight: "700", marginBottom: spacing.lg, color: colors.textPrimary },
  compareRow: { marginBottom: spacing.md },
  compareLabel: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", marginBottom: 4 },
  compareValues: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compareValue: { fontSize: 16, fontWeight: "600", flex: 1, textAlign: "center" },
  compareDivider: { fontSize: 12, color: colors.gray400, paddingHorizontal: spacing.sm },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  emptyBody: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, textAlign: "center" },
});