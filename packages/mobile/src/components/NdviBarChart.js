import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius } from "@agri/shared/theme";

export default function NdviBarChart({ points }) {
  if (!points?.length) {
    return <Text style={styles.empty}>No NDVI observations yet</Text>;
  }

  const maxVal = Math.max(...points.map((p) => p.value || 0), 0.01);

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {points.map((p, i) => {
          const h = Math.max(((p.value || 0) / maxVal) * 100, 4);
          const color =
            (p.value || 0) > 0.7 ? colors.green500 :
            (p.value || 0) > 0.4 ? colors.amber500 : colors.error;
          return (
            <View key={i} style={styles.barWrap}>
              <View style={[styles.bar, { height: `${h}%`, backgroundColor: color }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        <Text style={styles.date}>
          {new Date(points[0].timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Text>
        <Text style={styles.date}>
          {new Date(points[points.length - 1].timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Text>
      </View>
      <Text style={styles.latest}>
        Latest: {(points[points.length - 1].value || 0).toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 3,
  },
  barWrap: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { borderRadius: 3, minHeight: 4 },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  date: { fontSize: 10, color: colors.textSecondary },
  latest: { fontSize: 13, fontWeight: "600", color: colors.green700, marginTop: spacing.sm },
  empty: { color: colors.textSecondary, fontSize: 14, textAlign: "center", padding: spacing.lg },
});