import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from "react-native";
import { colors, spacing, radius } from "@agri/shared/theme";
import { getLandStatusBadge } from "@agri/shared/status";
import { useLandDetail } from "../hooks/useLandDetail";
import SectionHeader from "../components/SectionHeader";
import MetricGrid from "../components/MetricGrid";
import NdviBarChart from "../components/NdviBarChart";
import SatelliteGallery from "../components/SatelliteGallery";
import { resolveAssetUrl } from "../utils/resolveUrl";

export default function LandDetailScreen({ route }) {
  const { id } = route.params;
  const {
    land,
    crops,
    cropHealth,
    harvest,
    cropZones,
    aiInsights,
    loading,
    refreshing,
    error,
    aiError,
    aiLoading,
    analyzing,
    activeLayer,
    setActiveLayer,
    showAllImages,
    setShowAllImages,
    trackedVars,
    derived,
    refresh,
    triggerAiAnalysis,
    reanalyze,
  } = useLandDetail(id);

  const imagesWithUrls = useMemo(
    () =>
      (derived.visibleImages || []).map((img) => ({
        ...img,
        image_url: resolveAssetUrl(img.image_url || img.image_path),
      })),
    [derived.visibleImages]
  );

  if (loading && !land) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.green600} />
        <Text style={styles.loadingText}>Loading land intelligence...</Text>
      </View>
    );
  }

  if (error && !land) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!land) return null;

  const badge = getLandStatusBadge(land.status);
  const { latestCrop, latestClimate, latestSoil, latestWater, primaryCropType, ndviSeries } = derived;

  const metrics = [
    {
      label: "NDVI",
      value: latestCrop ? latestCrop.value?.toFixed(2) : "—",
      color: colors.green600,
      sub: latestCrop?.payload?.growth_stage?.replace("_", " "),
    },
    ...(trackedVars.includes("climate")
      ? [{
          label: "Temperature",
          value: latestClimate ? `${latestClimate.value}°C` : "—",
          sub: latestClimate?.payload?.humidity_pct ? `${latestClimate.payload.humidity_pct}% humidity` : undefined,
        }]
      : []),
    ...(trackedVars.includes("soil")
      ? [{
          label: "Soil Moisture",
          value: latestSoil ? `${latestSoil.value}%` : "—",
          sub: latestSoil?.payload?.soil_type,
        }]
      : []),
    {
      label: "Primary Crop",
      value: primaryCropType?.split("(")[0]?.trim() || "Unknown",
      sub: latestCrop?.payload?.ndvi_trend ? `Trend: ${latestCrop.payload.ndvi_trend}` : undefined,
    },
    {
      label: "Days to Harvest",
      value: harvest?.days_to_harvest != null
        ? (harvest.days_to_harvest < 0 ? "Done" : `${harvest.days_to_harvest}d`)
        : "—",
      color: colors.amber500,
    },
    ...(trackedVars.includes("water")
      ? [{
          label: "Water Need",
          value: latestWater?.payload?.crop_water_requirement_mm && land.area_hectares
            ? `${(latestWater.payload.crop_water_requirement_mm * land.area_hectares * 10).toFixed(0)} m³`
            : "—",
        }]
      : []),
  ];

  const openInMaps = () => {
    const url = `https://www.google.com/maps?q=${land.latitude},${land.longitude}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.green600} />
      }
    >
      <Text style={styles.title}>{land.name}</Text>
      <View style={[styles.badge, styles[`badge_${badge}`]]}>
        <Text style={styles.badgeText}>{land.status}</Text>
      </View>
      {land.description ? <Text style={styles.description}>{land.description}</Text> : null}

      <TouchableOpacity style={styles.mapLink} onPress={openInMaps}>
        <Text style={styles.mapLinkText}>
          📍 {land.latitude?.toFixed(4)}°N, {land.longitude?.toFixed(4)}°E • {land.area_hectares} ha — Open in Maps
        </Text>
      </TouchableOpacity>

      {(land.status === "processing" || analyzing) && (
        <View style={styles.processingBanner}>
          <ActivityIndicator size="small" color={colors.green600} />
          <Text style={styles.processingText}>
            {analyzing ? "AI analysis running..." : `Processing: ${land.status}`}
          </Text>
        </View>
      )}

      <SectionHeader title="Key Metrics" />
      <MetricGrid metrics={metrics} />

      <SectionHeader title="NDVI Trend" badge={`${ndviSeries.length} pts`} />
      <NdviBarChart points={ndviSeries} />

      <SectionHeader title="AI Analysis" badge={aiInsights.length ? `${aiInsights.length} insights` : undefined} />
      <TouchableOpacity
        style={[styles.aiBtn, analyzing && styles.aiBtnDisabled]}
        onPress={triggerAiAnalysis}
        disabled={analyzing || aiLoading}
      >
        <Text style={styles.aiBtnText}>
          {analyzing ? "Analyzing..." : "✨ Generate AI Analysis"}
        </Text>
      </TouchableOpacity>
      {aiError ? <Text style={styles.aiError}>{aiError}</Text> : null}
      {aiLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.green600} />
      ) : aiInsights.length > 0 ? (
        aiInsights.map((insight) => (
          <View key={insight.insight_id} style={styles.insightCard}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightBody}>{insight.body}</Text>
            {insight.confidence != null && (
              <Text style={styles.insightMeta}>
                Confidence: {Math.round(insight.confidence * 100)}%
              </Text>
            )}
          </View>
        ))
      ) : (
        <Text style={styles.emptySection}>No AI insights yet.</Text>
      )}

      {cropHealth && (
        <>
          <SectionHeader title="Crop Health" badge={`${cropHealth.health_score}/100`} />
          <View style={styles.healthCard}>
            <Text style={styles.healthScore}>{cropHealth.health_score}</Text>
            <Text style={styles.healthStatus}>{cropHealth.health_status?.replace("_", " ")}</Text>
            {cropHealth.advice ? <Text style={styles.healthAdvice}>{cropHealth.advice}</Text> : null}
          </View>
        </>
      )}

      {cropZones?.length > 0 && (
        <>
          <SectionHeader title="Crop Zones" badge={`${cropZones.length} detected`} />
          {cropZones.map((zone) => (
            <View key={zone.zone_id} style={styles.zoneCard}>
              <Text style={styles.zoneName}>{zone.crop_type?.split("(")[0]?.trim()}</Text>
              <Text style={styles.zoneMeta}>
                {zone.area_hectares ? `${zone.area_hectares.toFixed(1)} ha` : ""}
                {zone.latest_ndvi != null ? ` • NDVI ${zone.latest_ndvi.toFixed(2)}` : ""}
              </Text>
            </View>
          ))}
        </>
      )}

      <SectionHeader title="Satellite Imagery" badge={`${derived.filteredImages.length} images`} />
      <SatelliteGallery
        images={imagesWithUrls}
        activeLayer={activeLayer}
        onLayerChange={setActiveLayer}
        visibleImages={imagesWithUrls}
        filteredCount={derived.filteredImages.length}
        showAll={showAllImages}
        onToggleShowAll={() => setShowAllImages(!showAllImages)}
      />

      {crops.length === 0 && (
        <TouchableOpacity style={styles.reanalyzeBtn} onPress={reanalyze}>
          <Text style={styles.reanalyzeText}>Run Satellite Analysis</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  content: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  error: { color: colors.error, fontSize: 15, textAlign: "center", marginBottom: spacing.md },
  retryBtn: {
    backgroundColor: colors.green600,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, marginTop: spacing.sm },
  badge_healthy: { backgroundColor: colors.green50 },
  badge_warning: { backgroundColor: "#fffbeb" },
  badge_info: { backgroundColor: "#eff6ff" },
  badgeText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  description: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 22 },
  mapLink: {
    marginTop: spacing.md,
    backgroundColor: colors.bgPrimary,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapLinkText: { fontSize: 13, color: colors.green700, fontWeight: "500" },
  processingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#eff6ff",
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  processingText: { fontSize: 13, color: colors.info, fontWeight: "500" },
  aiBtn: {
    backgroundColor: "#7c3aed",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  aiBtnDisabled: { opacity: 0.6 },
  aiBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  aiError: { color: colors.error, fontSize: 13, marginBottom: spacing.sm },
  insightCard: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: "#7c3aed",
    borderWidth: 1,
    borderColor: colors.border,
  },
  insightTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  insightBody: { fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  insightMeta: { fontSize: 11, color: colors.gray400, marginTop: spacing.sm },
  emptySection: { color: colors.textSecondary, fontSize: 14, fontStyle: "italic" },
  healthCard: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  healthScore: { fontSize: 36, fontWeight: "700", color: colors.green600 },
  healthStatus: { fontSize: 14, fontWeight: "600", color: colors.textPrimary, textTransform: "capitalize" },
  healthAdvice: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  zoneCard: {
    backgroundColor: colors.bgPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoneName: { fontSize: 15, fontWeight: "600" },
  zoneMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  reanalyzeBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.green600,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  reanalyzeText: { color: "#fff", fontWeight: "600" },
});