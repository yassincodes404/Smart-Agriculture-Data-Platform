/**
 * services/api.js
 * ---------------
 * Central API client for communicating with the backend.
 *
 * All backend calls go through here so that:
 * - Base URL is configured in one place
 * - Auth token is attached automatically
 * - Error handling is consistent
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

  const data = await response.json();

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
   ---------------------------------------------------------------- */

/**
 * POST /auth/register
 */
export async function registerUser({ email, password, role = "viewer" }) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

/**
 * POST /auth/login
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
 * GET /auth/me
 */
export async function getMe() {
  return request("/auth/me");
}

/**
 * POST /auth/logout
 */
export async function logoutUser() {
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

/* ----------------------------------------------------------------
   Health Check
   ---------------------------------------------------------------- */

export async function healthCheck() {
  const response = await fetch("/api/health");
  return response.json();
}
