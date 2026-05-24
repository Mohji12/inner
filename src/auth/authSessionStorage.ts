import type { AuthRole } from "@/api/client";

const AUTH_KEY = "inner_path_session_auth_v1";

export type PersistedSessionAuth = {
  v: 1;
  role: AuthRole;
  accessToken: string;
};

function isRole(x: string): x is AuthRole {
  return x === "user" || x === "mentor" || x === "admin";
}

function migrateSessionToLocalOnce(): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    if (typeof sessionStorage === "undefined") return;
    const fromSession = sessionStorage.getItem(AUTH_KEY);
    if (!fromSession) return;
    if (!localStorage.getItem(AUTH_KEY)) {
      localStorage.setItem(AUTH_KEY, fromSession);
    }
    sessionStorage.removeItem(AUTH_KEY);
  } catch {
    // ignore
  }
}

export function readPersistedSessionAuth(): PersistedSessionAuth | null {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
    migrateSessionToLocalOnce();
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const obj = p as Record<string, unknown>;
    if (obj.v !== 1 || typeof obj.accessToken !== "string" || !obj.accessToken.trim()) return null;
    if (typeof obj.role !== "string" || !isRole(obj.role)) return null;
    return { v: 1, role: obj.role, accessToken: obj.accessToken };
  } catch {
    return null;
  }
}

export function writePersistedSessionAuth(entry: PersistedSessionAuth | null): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    if (!entry) {
      localStorage.removeItem(AUTH_KEY);
      try {
        sessionStorage.removeItem(AUTH_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify(entry));
  } catch {
    // Private mode / disabled storage — app still works until refresh.
  }
}
