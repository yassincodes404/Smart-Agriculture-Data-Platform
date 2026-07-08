import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { colors, spacing, radius } from "@agri/shared/theme";

const LAYERS = [
  { key: "true_color", label: "True Color" },
  { key: "ndvi", label: "NDVI" },
];

export default function SatelliteGallery({
  images,
  activeLayer,
  onLayerChange,
  visibleImages,
  filteredCount,
  showAll,
  onToggleShowAll,
}) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {LAYERS.map((l) => (
          <TouchableOpacity
            key={l.key}
            style={[styles.tab, activeLayer === l.key && styles.tabActive]}
            onPress={() => onLayerChange(l.key)}
          >
            <Text style={[styles.tabText, activeLayer === l.key && styles.tabTextActive]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {visibleImages.length === 0 ? (
        <Text style={styles.empty}>No {activeLayer.replace("_", " ")} images yet</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
          {visibleImages.map((img, i) => (
            <View key={img.id || i} style={styles.card}>
              {img.image_url ? (
                <Image source={{ uri: img.image_url }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderText}>{img.image_type === "ndvi" ? "NDVI" : "RGB"}</Text>
                </View>
              )}
              <Text style={styles.date}>{new Date(img.date).toLocaleDateString()}</Text>
              {img.ndvi_mean != null && (
                <Text style={styles.ndvi}>NDVI {img.ndvi_mean.toFixed(2)}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {filteredCount > 6 && (
        <TouchableOpacity onPress={onToggleShowAll} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {showAll ? "Show less" : `Show all (${filteredCount})`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    marginRight: spacing.sm,
  },
  tabActive: { backgroundColor: colors.green600 },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  tabTextActive: { color: "#fff" },
  gallery: { gap: spacing.sm, paddingBottom: spacing.sm },
  card: {
    width: 140,
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: 140, height: 120 },
  placeholder: {
    width: 140,
    height: 120,
    backgroundColor: colors.green950,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  date: { fontSize: 11, color: colors.textSecondary, padding: spacing.sm },
  ndvi: { fontSize: 11, fontWeight: "600", color: colors.green600, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  empty: { color: colors.textSecondary, padding: spacing.lg, textAlign: "center" },
  toggle: { alignItems: "center", paddingVertical: spacing.sm },
  toggleText: { color: colors.green600, fontWeight: "600", fontSize: 14 },
});