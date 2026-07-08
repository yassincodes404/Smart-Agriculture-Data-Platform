/**
 * @agri/shared/landDetail — Platform-agnostic land detail logic
 */

export function groupCropsByType(crops) {
  return (crops || []).reduce((acc, c) => {
    const t = c.payload?.crop_type || "Unknown";
    if (!acc[t]) acc[t] = [];
    acc[t].push(c);
    return acc;
  }, {});
}

export function getPrimaryZone(cropZones) {
  if (!cropZones?.length) return null;
  return cropZones.reduce(
    (best, z) =>
      (z.area_pct || z.avg_confidence) > (best.area_pct || best.avg_confidence) ? z : best,
    cropZones[0]
  );
}

export function deterministicAI(seedStr, min, max) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) hash = Math.imul(31, hash) + seedStr.charCodeAt(i) | 0;
  const normalized = (Math.abs(hash) % 1000) / 1000;
  return min + normalized * (max - min);
}

export function estimateValue({ value, seed, type, area }) {
  if (value != null && value !== "") return value;

  if (type === "days_to_harvest") {
    return Math.floor(deterministicAI(seed, 10, 60));
  }
  if (type === "harvest_date") {
    const days = Math.floor(deterministicAI(seed, 10, 60));
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }
  return null;
}

/**
 * Fetch all land detail datasets in parallel.
 * @param {string} landId
 * @param {object} api — injected API client methods
 */
export async function fetchLandDetailBundle(landId, api) {
  const safe = (p, fallback) => p.catch(() => fallback);

  const [
    land,
    climateRes,
    cropsRes,
    soilRes,
    waterRes,
    imagesRes,
    zonesRes,
    cropHealth,
    harvest,
    aiRes,
  ] = await Promise.all([
    api.getLandDetail(landId),
    safe(api.getLandTimeseries(landId, "climate"), { points: [] }),
    safe(api.getLandTimeseries(landId, "crops"), { points: [] }),
    safe(api.getLandTimeseries(landId, "soil"), { points: [] }),
    safe(api.getLandTimeseries(landId, "water"), { points: [] }),
    safe(api.getLandImages(landId), { images: [] }),
    safe(api.getCropZones(landId), { zones: [] }),
    safe(api.getCropHealth(landId), null),
    safe(api.getHarvestPrediction(landId), null),
    safe(api.getAiInsights(landId), { insights: [] }),
  ]);

  return {
    land,
    climate: climateRes.points || [],
    crops: cropsRes.points || [],
    soil: soilRes.points || [],
    water: waterRes.points || [],
    images: imagesRes.images || [],
    cropZones: zonesRes.zones || [],
    cropHealth,
    harvest,
    aiInsights: aiRes.insights || [],
    aiError: aiRes.error || null,
  };
}

export function computeLandDetailDerived({
  crops = [],
  climate = [],
  soil = [],
  water = [],
  cropZones = [],
  images = [],
  activeLayer = "true_color",
  showAllImages = false,
}) {
  const latestCrop = crops.length > 0 ? crops[crops.length - 1] : null;
  const latestClimate = climate.length > 0 ? climate[climate.length - 1] : null;
  const latestSoil = soil.length > 0 ? soil[soil.length - 1] : null;
  const latestWater = water.length > 0 ? water[water.length - 1] : null;
  const primaryZone = getPrimaryZone(cropZones);
  const primaryCropType = primaryZone
    ? primaryZone.crop_type
    : (crops.length > 0 ? crops[crops.length - 1].payload?.crop_type : null);
  const cropsByType = groupCropsByType(crops);
  const filteredImages = images.filter((img) =>
    activeLayer === "true_color" ? img.image_type === "true_color" : img.image_type === "ndvi"
  );
  const visibleImages = showAllImages ? filteredImages : filteredImages.slice(0, 6);
  const avgSoilMoisture = soil.length > 0
    ? (soil.reduce((acc, s) => acc + (s.value || 0), 0) / soil.length).toFixed(1)
    : null;
  const avgClimateTemp = climate.length > 0
    ? (climate.reduce((acc, c) => acc + (c.value || 0), 0) / climate.length).toFixed(1)
    : null;

  const ndviSeries = crops.length > 12 ? crops.slice(-12) : crops;

  return {
    latestCrop,
    latestClimate,
    latestSoil,
    latestWater,
    primaryZone,
    primaryCropType,
    cropsByType,
    filteredImages,
    visibleImages,
    avgSoilMoisture,
    avgClimateTemp,
    ndviSeries,
  };
}