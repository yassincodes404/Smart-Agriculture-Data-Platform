import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { colors, spacing, radius, layout } from "@agri/shared/theme";
import { discoverLand } from "../api";
import LandMapDrawer from "../components/LandMapDrawer";

const TRACKING_OPTIONS = [
  { key: "ndvi", label: "NDVI" },
  { key: "climate", label: "Climate" },
  { key: "soil", label: "Soil" },
  { key: "water", label: "Water" },
];

export default function AddLandScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [geometry, setGeometry] = useState(null);
  const [shapeStats, setShapeStats] = useState(null);
  const [trackingVariables, setTrackingVariables] = useState(["ndvi", "climate", "soil", "water"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleGeometryChange = useCallback((geojson, stats) => {
    setGeometry(geojson);
    setShapeStats(stats);
    setError(null);
  }, []);

  const toggleTracking = (key) => {
    setTrackingVariables((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError("Please enter a land name.");
      return;
    }
    if (!geometry) {
      setError("Draw your land boundary on the map and tap Finish.");
      return;
    }

    setLoading(true);
    try {
      const result = await discoverLand({
        name: name.trim(),
        description: description.trim() || null,
        geometry,
        metadata_: {
          trackingFrequency: "16 days",
          trackingVariables,
        },
      });

      const publicId = result.public_id;
      setSuccess(`"${name.trim()}" registered. Analysis started.`);

      setTimeout(() => {
        navigation.dispatch(
          CommonActions.navigate({
            name: "LandDetail",
            params: { id: publicId },
          })
        );
      }, 1200);
    } catch (e) {
      setError(e.message || "Failed to register land.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Register New Land</Text>
        <Text style={styles.subtitle}>
          Tap the map to outline your plot, then fill in the details below.
        </Text>

        <LandMapDrawer onGeometryChange={handleGeometryChange} />

        {shapeStats && (
          <Text style={styles.areaHint}>
            Area: ~{shapeStats.areaHectares?.toFixed(2)} ha • {shapeStats.vertexCount} corners
          </Text>
        )}

        <Text style={styles.label}>Land Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Nile Delta - Plot A"
          placeholderTextColor={colors.gray400}
          value={name}
          onChangeText={setName}
          editable={!loading}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Crop type, irrigation, landmarks..."
          placeholderTextColor={colors.gray400}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          editable={!loading}
        />

        <Text style={styles.label}>Track</Text>
        <View style={styles.chips}>
          {TRACKING_OPTIONS.map((opt) => {
            const active = trackingVariables.includes(opt.key);
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleTracking(opt.key)}
                disabled={loading}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Register Land</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bgSecondary },
  content: { padding: spacing.lg, paddingBottom: spacing["2xl"] },
  title: { fontSize: 22, fontWeight: "700", color: colors.green800 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 20 },
  areaHint: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.green700,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.bgPrimary,
    minHeight: layout.touchTarget,
  },
  textArea: { minHeight: 88, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgPrimary,
    minHeight: 36,
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.green500, backgroundColor: colors.green50 },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  chipTextActive: { color: colors.green700 },
  error: { color: colors.error, fontSize: 14, marginTop: spacing.md },
  success: { color: colors.green700, fontSize: 14, marginTop: spacing.md, fontWeight: "600" },
  submitBtn: {
    backgroundColor: colors.green600,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});