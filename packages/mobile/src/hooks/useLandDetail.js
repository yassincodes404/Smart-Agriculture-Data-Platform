/**
 * Mobile useLandDetail — uses @agri/shared fetch + derived logic
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { fetchLandDetailBundle, computeLandDetailDerived } from "@agri/shared/landDetail";
import { api, getLandDetail } from "../api";

export function useLandDetail(landId) {
  const [land, setLand] = useState(null);
  const [climate, setClimate] = useState([]);
  const [crops, setCrops] = useState([]);
  const [soil, setSoil] = useState([]);
  const [water, setWater] = useState([]);
  const [images, setImages] = useState([]);
  const [cropHealth, setCropHealth] = useState(null);
  const [harvest, setHarvest] = useState(null);
  const [cropZones, setCropZones] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeLayer, setActiveLayer] = useState("true_color");
  const [showAllImages, setShowAllImages] = useState(false);
  const pollRef = useRef(null);

  const trackedVars = land?.metadata_?.trackingVariables || ["ndvi", "climate", "soil", "water"];

  const load = useCallback(async (isRefresh = false) => {
    if (!landId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setAiLoading(true);

    try {
      const bundle = await fetchLandDetailBundle(landId, api);
      setLand(bundle.land);
      setClimate(bundle.climate);
      setCrops(bundle.crops);
      setSoil(bundle.soil);
      setWater(bundle.water);
      setImages(bundle.images);
      setCropZones(bundle.cropZones);
      setCropHealth(bundle.cropHealth);
      setHarvest(bundle.harvest);
      setAiInsights(bundle.aiInsights);
      setAiError(null);
    } catch (e) {
      setError(e.message || "Failed to load land");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setAiLoading(false);
    }
  }, [landId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while processing
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (land && land.status !== "active" && land.status !== "ready") {
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getLandDetail(landId);
          setLand(updated);
          if (updated.status === "active" || updated.status === "ready") {
            clearInterval(pollRef.current);
            load(true);
          }
        } catch {
          // ignore poll errors
        }
      }, 3000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [land?.status, landId, load]);

  const derived = useMemo(
    () =>
      computeLandDetailDerived({
        crops,
        climate,
        soil,
        water,
        cropZones,
        images,
        activeLayer,
        showAllImages,
      }),
    [crops, climate, soil, water, cropZones, images, activeLayer, showAllImages]
  );

  const triggerAiAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setAiError(null);
    try {
      await api.triggerAiAnalysisAsync(landId);
      setTimeout(() => load(true), 4000);
    } catch (e) {
      if (e.response?.status === 429) {
        setAiError("AI quota finished. Try again later.");
      } else {
        setAiError(e.message || "AI analysis failed");
      }
    } finally {
      setAnalyzing(false);
    }
  }, [landId, load]);

  const reanalyze = useCallback(async () => {
    try {
      await api.reanalyzeLand(landId);
      setLand((prev) => (prev ? { ...prev, status: "processing" } : prev));
    } catch (e) {
      setError(e.message);
    }
  }, [landId]);

  return {
    land,
    climate,
    crops,
    soil,
    water,
    images,
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
    refresh: () => load(true),
    triggerAiAnalysis,
    reanalyze,
  };
}