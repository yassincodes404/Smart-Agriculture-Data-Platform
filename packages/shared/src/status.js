/**
 * Land status helpers — shared between web and mobile
 */

export function getLandStatusColor(status) {
  if (!status) return "info";
  const s = status.toLowerCase();
  if (s === "ready" || s === "active" || s === "completed") return "healthy";
  if (s === "error" || s === "failed" || s.includes("fail") || s.includes("error")) return "critical";
  if (s === "processing" || s.includes("step") || s.includes("fetch")) return "warning";
  return "info";
}

export function getLandStatusBadge(status) {
  if (status === "ready" || status === "active") return "healthy";
  if (status === "processing") return "warning";
  return "info";
}