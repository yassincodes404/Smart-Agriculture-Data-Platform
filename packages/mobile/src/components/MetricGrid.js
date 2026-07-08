import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius } from "@agri/shared/theme";

export default function MetricGrid({ metrics }) {
  return (
    <View style={styles.grid}>
      {metrics.map((m) => (
        <View key={m.label} style={styles.card}>
          <Text style={[styles.value, m.color ? { color: m.color } : null]}>{m.value}</Text>
          <Text style={styles.label}>{m.label}</Text>
          {m.sub ? <Text style={styles.sub}>{m.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  card: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  label: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  sub: { fontSize: 11, color: colors.gray400, marginTop: 2 },
});