export const API_V1_PREFIX = "/api/v1";

/**
 * API origin (no trailing slash). Empty string = same origin (use Vite dev proxy to FastAPI).
 * Set `VITE_API_URL` when the API is on another host (e.g. production).
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL ?? "";
  return raw.replace(/\/$/, "");
}

/**
 * Base URL for v1 REST routes. Handles both `VITE_API_URL=http://host:port` and
 * `.../api/v1` without duplicating the prefix.
 */
export function getApiV1BaseUrl(): string {
  const base = getApiBaseUrl();
  if (!base) {
    return API_V1_PREFIX;
  }
  const root = base.replace(/\/api\/v1\/?$/i, "");
  return `${root}${API_V1_PREFIX}`;
}

/** WebSocket URL for chat signaling; mirrors REST base from `getApiV1BaseUrl` (avoid Vite WS proxy mismatch when API is absolute). */
export function getChatWebSocketUrl(sessionId: string, token: string): string {
  const path = `/ws/chat/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
  const v1 = getApiV1BaseUrl().replace(/\/$/, "");
  if (v1.startsWith("http://") || v1.startsWith("https://")) {
    const u = new URL(v1);
    const wsScheme = u.protocol === "https:" ? "wss:" : "ws:";
    const rootPath = u.pathname.replace(/\/$/, "");
    return `${wsScheme}//${u.host}${rootPath}${path}`;
  }
  const proto =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost";
  return `${proto}//${host}${v1}${path}`;
}
