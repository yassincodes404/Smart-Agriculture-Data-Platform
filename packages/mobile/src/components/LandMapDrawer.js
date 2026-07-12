import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { colors, spacing, radius, layout } from "@agri/shared/theme";
import {
  getDefaultMapRegion,
  pointsToGeoJSON,
  computePolygonAreaHectares,
} from "@agri/shared/geometry";

/**
 * Tap-to-draw polygon map for land registration.
 * Calls onGeometryChange(geojson, stats) when polygon is completed.
 */
export default function LandMapDrawer({ onGeometryChange }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(getDefaultMapRegion(6));
  const [points, setPoints] = useState([]);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch {
        // keep Egypt default
      }
    })();
  }, []);

  useEffect(() => {
    if (completed && points.length >= 3) {
      const geometry = pointsToGeoJSON(points);
      const area = computePolygonAreaHectares(points);
      onGeometryChange?.(geometry, {
        areaHectares: area,
        vertexCount: points.length,
      });
    } else if (points.length === 0) {
      onGeometryChange?.(null, null);
    }
  }, [points, completed, onGeometryChange]);

  const handleMapPress = (e) => {
    if (completed) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPoints((prev) => [...prev, { latitude, longitude }]);
  };

  const handleUndo = () => {
    setCompleted(false);
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setCompleted(false);
    setPoints([]);
    onGeometryChange?.(null, null);
  };

  const handleFinish = () => {
    if (points.length >= 3) setCompleted(true);
  };

  const handleRedraw = () => {
    setCompleted(false);
  };

  const area = points.length >= 3 ? computePolygonAreaHectares(points) : 0;

  return (
    <View style={styles.wrapper}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        mapType="hybrid"
        region={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {points.length >= 2 && (
          <Polygon
            coordinates={points}
            strokeColor={colors.green600}
            fillColor="rgba(34, 197, 94, 0.2)"
            strokeWidth={2}
          />
        )}
        {points.map((p, i) => (
          <Marker
            key={`${p.latitude}-${p.longitude}-${i}`}
            coordinate={p}
            pinColor={i === 0 ? colors.green700 : colors.green500}
          />
        ))}
      </MapView>

      <View style={styles.instructions}>
        <Text style={styles.instructionText}>
          {completed
            ? "Boundary set. Tap Redraw to change."
            : points.length < 3
              ? `Tap map to add corners (${points.length}/3 min)`
              : `Tap Finish to confirm • ~${area.toFixed(2)} ha`}
        </Text>
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolBtn, points.length === 0 && styles.toolBtnDisabled]}
          onPress={handleUndo}
          disabled={points.length === 0 || completed}
        >
          <Text style={styles.toolBtnText}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolBtn, points.length === 0 && styles.toolBtnDisabled]}
          onPress={handleClear}
          disabled={points.length === 0}
        >
          <Text style={styles.toolBtnText}>Clear</Text>
        </TouchableOpacity>
        {completed ? (
          <TouchableOpacity style={[styles.toolBtn, styles.toolBtnPrimary]} onPress={handleRedraw}>
            <Text style={styles.toolBtnTextPrimary}>Redraw</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.toolBtn, styles.toolBtnPrimary, points.length < 3 && styles.toolBtnDisabled]}
            onPress={handleFinish}
            disabled={points.length < 3}
          >
            <Text style={styles.toolBtnTextPrimary}>Finish</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 280,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  map: { flex: 1 },
  instructions: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  instructionText: { fontSize: 12, fontWeight: "600", color: colors.textPrimary, textAlign: "center" },
  toolbar: {
    position: "absolute",
    bottom: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  toolBtn: {
    flex: 1,
    minHeight: layout.touchTarget,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolBtnPrimary: { backgroundColor: colors.green600, borderColor: colors.green700 },
  toolBtnDisabled: { opacity: 0.45 },
  toolBtnText: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  toolBtnTextPrimary: { fontSize: 13, fontWeight: "700", color: "#fff" },
});