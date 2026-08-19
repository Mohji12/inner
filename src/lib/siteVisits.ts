import { apiFetch } from "@/api/client";
import { safeLocalStorage } from "@/lib/safeStorage";

const SESSION_KEY = "ipd_visit_sid";

function newSessionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === "x" ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getVisitSessionKey(): string {
  const existing = safeLocalStorage.getItem(SESSION_KEY)?.trim();
  if (existing && existing.length >= 8) return existing.slice(0, 36);
  const created = newSessionKey();
  safeLocalStorage.setItem(SESSION_KEY, created);
  return created;
}

/** Keep in sync with backend `should_skip_path` (admin/dashboard/chat are not public visits). */
export function shouldSkipVisitPath(path: string): boolean {
  if (path === "/user" || path === "/mentor") return true;
  if (path.startsWith("/admin") || path.startsWith("/chat")) return true;
  if (path.startsWith("/user/") && !path.startsWith("/user/register")) return true;
  if (path.startsWith("/mentor/") && !path.startsWith("/mentor/register")) return true;
  return false;
}

export function reportPageView(path: string, visitorKind: string | null): void {
  const pathname = path.split("?")[0] || path;
  if (shouldSkipVisitPath(pathname)) return;
  void apiFetch("/analytics/page-views", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({
      path,
      session_key: getVisitSessionKey(),
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      visitor_kind: visitorKind,
    }),
  }).catch(() => {
    // Fire-and-forget: analytics must never interrupt browsing.
  });
}
