/**
 * @agri/shared/geometry — GeoJSON polygon helpers (web + mobile)
 */

const EGYPT_CENTER = { latitude: 26.8, longitude: 30.8 };

export function getDefaultMapRegion(delta = 8) {
  return {
    latitude: EGYPT_CENTER.latitude,
    longitude: EGYPT_CENTER.longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

/** Lat/lng points [{latitude, longitude}] → GeoJSON Polygon */
export function pointsToGeoJSON(points) {
  if (!points || points.length < 3) return null;
  const coords = points.map((p) => [p.longitude, p.latitude]);
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

/** Approximate geodesic area in hectares from lat/lng ring */
export function computePolygonAreaHectares(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lat1 = (points[i].latitude * Math.PI) / 180;
    const lat2 = (points[j].latitude * Math.PI) / 180;
    const lng1 = (points[i].longitude * Math.PI) / 180;
    const lng2 = (points[j].longitude * Math.PI) / 180;
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * 6378137 * 6378137) / 2);
  return area / 10000;
}

export function getPolygonCentroid(points) {
  if (!points?.length) return null;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.latitude, lng: acc.lng + p.longitude }),
    { lat: 0, lng: 0 }
  );
  return {
    latitude: sum.lat / points.length,
    longitude: sum.lng / points.length,
  };
}