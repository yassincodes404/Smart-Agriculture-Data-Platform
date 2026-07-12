import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing } from "@agri/shared/theme";

export default function SectionHeader({ title, badge }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  title: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.green700,
    backgroundColor: colors.green50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
});