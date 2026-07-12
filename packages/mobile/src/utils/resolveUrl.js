import Constants from "expo-constants";

const API_BASE =
  Constants.expoConfig?.extra?.apiBaseUrl || "http://10.0.2.2:8000/api/v1";

const SERVER_BASE = API_BASE.replace(/\/api\/v1\/?$/, "");

export function resolveAssetUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/")) return `${SERVER_BASE}${path}`;
  return `${SERVER_BASE}/${path}`;
}