/**
 * services/api.js
 * ---------------
 * Central API client for communicating with the backend.
 *
 * All backend calls go through here so that:
 * - Base URL is configured in one place
 * - Auth token is attached automatically
 * - Error handling is consistent
 *
 * Backend endpoints (FastAPI at /api/v1):
 *   Auth:   POST /auth/register, POST /auth/login, GET /auth/me, POST /auth/logout
 *   Lands:  POST /lands/discover, GET /lands/{id}, GET /lands/{id}/timeseries, GET /lands/{id}/images
 *   Health: GET /api/health
 */

const API_BASE = "/api/v1";

/**
 * Get the stored JWT token.
 */
export function getToken() {
  return localStorage.getItem("agri_token");
}

/**
 * Store the JWT token.
 */
export function setToken(token) {
  localStorage.setItem("agri_token", token);
}

/**
 * Remove the JWT token.
 */
export function clearToken() {
  localStorage.removeItem("agri_token");
}

/**
 * Make an authenticated API request.
 * All responses from the backend follow the envelope: { status, data, message, meta }
 */
async function request(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle non-JSON responses gracefully
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Request failed with status ${response.status}`);
  }

  if (!response.ok) {
    const errorMessage =
      data.detail ||
      data.message ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

/* ----------------------------------------------------------------
   Auth Endpoints
   Backend: app/api/auth.py
   ---------------------------------------------------------------- */

/**
 * POST /api/v1/auth/register
 * Body: { email, password, role }
 * Response: { status: "success", data: { user_id, email, role, ... } }
 */
export async function registerUser({ email, password, role = "viewer" }) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 * Response: { status: "success", data: { access_token, token_type } }
 */
export async function loginUser({ email, password }) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  // Store the token automatically on successful login
  if (data?.data?.access_token) {
    setToken(data.data.access_token);
  }

  return data;
}

/**
 * GET /api/v1/auth/me
 * Response: { status: "success", data: { user_id, email, role, is_active, ... } }
 */
export async function getMe() {
  return request("/auth/me");
}

/**
 * POST /api/v1/auth/logout
 * Clears client-side token regardless of server response.
 */
export async function logoutUser() {
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

/* ----------------------------------------------------------------
   Lands Endpoints
   Backend: app/api/lands.py
   ---------------------------------------------------------------- */

/**
 * GET /api/v1/lands
 * Response: { lands: [...], total }
 */
export async function listLands() {
  return request("/lands");
}

/**
 * POST /api/v1/lands/discover
 * Register a new land from a GeoJSON polygon.
 * Body: { name, description, geometry: { type: "Polygon", coordinates: [...] } }
 * Response: { status: "processing", land_id }
 */
export async function discoverLand({ name, description, geometry }) {
  return request("/lands/discover", {
    method: "POST",
    body: JSON.stringify({ name, description, geometry }),
  });
}

/**
 * GET /api/v1/lands/{landId}
 * Response: { land_id, name, description, latitude, longitude, area_hectares, status, boundary_polygon, created_at }
 */
export async function getLandDetail(landId) {
  return request(`/lands/${landId}`);
}

/**
 * GET /api/v1/lands/{landId}/timeseries?metric=climate|water|crops|soil
 * Response: { land_id, metric, points: [{ timestamp, value, payload }] }
 */
export async function getLandTimeseries(landId, metric = "climate") {
  return request(`/lands/${landId}/timeseries?metric=${metric}`);
}

/**
 * GET /api/v1/lands/{landId}/images?image_type=true_color|ndvi|user_upload
 * Response: { land_id, images: [{ id, date, image_type, image_path, ndvi_mean, cloud_cover_pct }] }
 */
export async function getLandImages(landId, imageType = null) {
  const qs = imageType ? `?image_type=${imageType}` : "";
  return request(`/lands/${landId}/images${qs}`);
}

/**
 * GET /api/v1/lands/{landId}/crop-zones
 * Response: { land_id, total_zones, zones: [...] }
 */
export async function getCropZones(landId) {
  return request(`/lands/${landId}/crop-zones`);
}

/**
 * POST /api/v1/lands/{landId}/analyze
 * Triggers a background re-analysis: fetch new satellite images, recompute NDVI.
 * Old images and data are preserved — only new data is appended.
 */
export async function reanalyzeLand(landId) {
  return request(`/lands/${landId}/analyze`, { method: "POST" });
}

/**
 * PATCH /api/v1/lands/{landId}/settings
 * Update per-land settings (e.g. monitoring_interval_days).
 */
export async function updateLandSettings(landId, settings) {
  return request(`/lands/${landId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

/**
 * GET /api/v1/lands/{landId}/ndvi-comparison
 * Returns weekly NDVI snapshots over time for progress tracking.
 */
export async function getNdviComparison(landId, weeks = 8) {
  return request(`/lands/${landId}/ndvi-comparison?weeks=${weeks}`);
}

/* ----------------------------------------------------------------
   Crop Intelligence Endpoints
   Backend: app/api/crops.py
   ---------------------------------------------------------------- */

/** GET /api/v1/lands/{landId}/crop-health */
export async function getCropHealth(landId) {
  return request(`/lands/${landId}/crop-health`);
}

/** GET /api/v1/lands/{landId}/crop-status */
export async function getCropStatus(landId) {
  return request(`/lands/${landId}/crop-status`);
}

/** GET /api/v1/lands/{landId}/crop-trend?days=90 */
export async function getCropTrend(landId, days = 90) {
  return request(`/lands/${landId}/crop-trend?days=${days}`);
}

/** GET /api/v1/lands/{landId}/harvest-prediction */
export async function getHarvestPrediction(landId) {
  return request(`/lands/${landId}/harvest-prediction`);
}

/** GET /api/v1/lands/{landId}/crop-detection */
export async function getCropDetection(landId) {
  return request(`/lands/${landId}/crop-detection`);
}

/* ----------------------------------------------------------------
   Soil Intelligence Endpoints
   Backend: app/api/soil.py
   ---------------------------------------------------------------- */

/** GET /api/v1/lands/{landId}/soil-profile */
export async function getSoilProfile(landId) {
  return request(`/lands/${landId}/soil-profile`);
}

/** GET /api/v1/lands/{landId}/soil-suitability */
export async function getSoilSuitability(landId, crop = null) {
  const qs = crop ? `?crop=${crop}` : "";
  return request(`/lands/${landId}/soil-suitability${qs}`);
}

/** GET /api/v1/lands/{landId}/soil-status */
export async function getSoilStatus(landId) {
  return request(`/lands/${landId}/soil-status`);
}

/* ----------------------------------------------------------------
   Health Check
   Backend: app/api/health.py
   ---------------------------------------------------------------- */

/**
 * GET /api/health
 * Response: { status: "backend running" }
 */
export async function healthCheck() {
  const response = await fetch("/api/health");
  return response.json();
}

/**
 * GET /api/health/db
 * Response: { status: "success"|"error", result|message }
 */
export async function healthCheckDb() {
  const response = await fetch("/api/health/db");
  return response.json();
}

/* ----------------------------------------------------------------
   AI Endpoints
   Backend: app/api/ai.py
   ---------------------------------------------------------------- */

/** GET /ai/keys — list user's API keys (masked) */
export async function getAiApiKeys() {
  return request("/ai/keys");
}

/** POST /ai/keys — add a new API key */
export async function addAiApiKey(apiKey, label = null, provider = "groq") {
  return request("/ai/keys", {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey, label, provider }),
  });
}

/** DELETE /ai/keys/{key_id} — remove an API key */
export async function deleteAiApiKey(keyId) {
  return request(`/ai/keys/${keyId}`, { method: "DELETE" });
}

/** PATCH /ai/keys/{key_id}/toggle — enable/disable a key */
export async function toggleAiApiKey(keyId, isActive) {
  return request(`/ai/keys/${keyId}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

/** GET /ai/lands/{land_id}/chat — get chat history */
export async function getAiChatHistory(landId) {
  return request(`/ai/lands/${landId}/chat`);
}

/** POST /ai/lands/{land_id}/chat — send a message */
export async function sendAiChatMessage(landId, message) {
  return request(`/ai/lands/${landId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/** DELETE /ai/lands/{land_id}/chat — clear chat history */
export async function clearAiChatHistory(landId) {
  return request(`/ai/lands/${landId}/chat`, { method: "DELETE" });
}

/** GET /ai/lands/{land_id}/insights — get AI insights */
export async function getAiInsights(landId) {
  return request(`/ai/lands/${landId}/insights`);
}

/** POST /ai/lands/{land_id}/analyze — trigger fresh AI analysis */
export async function triggerAiAnalysis(landId) {
  return request(`/ai/lands/${landId}/analyze`, { method: "POST" });
}
