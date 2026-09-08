import type { AuthRole } from "@/api/client";

const LEGACY_AUTH_KEY = "inner_path_session_auth_v1";
const AUTH_KEY_V2 = "inner_path_auth_tokens_v2";
const TAB_ROLE_KEY = "inner_path_tab_role_v1";

export type PersistedAuthTokens = {
  v: 2;
  user: string | null;
  mentor: string | null;
  admin: string | null;
};

export type PersistedSessionAuth = {
  v: 1;
  role: AuthRole;
  accessToken: string;
};

function isRole(x: string): x is AuthRole {
  return x === "user" || x === "mentor" || x === "admin";
}

function cleanToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  return trimmed ? trimmed : null;
}

/**
 * Migrates any legacy v1 storage (single token) into v2 partitioned storage.
 */
function migrateLegacyStorageOnce(): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;

    // Migrate old sessionStorage v1 to localStorage if present
    if (typeof sessionStorage !== "undefined") {
      const fromSession = sessionStorage.getItem(LEGACY_AUTH_KEY);
      if (fromSession && !localStorage.getItem(LEGACY_AUTH_KEY) && !localStorage.getItem(AUTH_KEY_V2)) {
        localStorage.setItem(LEGACY_AUTH_KEY, fromSession);
      }
      sessionStorage.removeItem(LEGACY_AUTH_KEY);
    }

    // If v2 already exists, nothing to migrate
    if (localStorage.getItem(AUTH_KEY_V2)) return;

    // Check v1
    const rawV1 = localStorage.getItem(LEGACY_AUTH_KEY);
    if (!rawV1) return;

    const parsed = JSON.parse(rawV1) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const role = typeof obj.role === "string" && isRole(obj.role) ? obj.role : null;
      const token = cleanToken(obj.accessToken);
      if (role && token) {
        const initialV2: PersistedAuthTokens = {
          v: 2,
          user: role === "user" ? token : null,
          mentor: role === "mentor" ? token : null,
          admin: role === "admin" ? token : null,
        };
        localStorage.setItem(AUTH_KEY_V2, JSON.stringify(initialV2));
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(TAB_ROLE_KEY, role);
        }
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Reads all role tokens currently saved in localStorage.
 */
export function readPersistedTokens(): PersistedAuthTokens {
  const empty: PersistedAuthTokens = { v: 2, user: null, mentor: null, admin: null };
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return empty;
    migrateLegacyStorageOnce();

    const raw = localStorage.getItem(AUTH_KEY_V2);
    if (!raw) return empty;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return empty;
    const obj = parsed as Record<string, unknown>;

    return {
      v: 2,
      user: cleanToken(obj.user),
      mentor: cleanToken(obj.mentor),
      admin: cleanToken(obj.admin),
    };
  } catch {
    return empty;
  }
}

/**
 * Saves or clears an access token for a specific role without affecting other roles.
 */
export function savePersistedRoleToken(role: AuthRole, token: string | null): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    const current = readPersistedTokens();
    const updated: PersistedAuthTokens = {
      ...current,
      [role]: cleanToken(token),
    };
    localStorage.setItem(AUTH_KEY_V2, JSON.stringify(updated));

    // Also remove legacy key to prevent confusion
    localStorage.removeItem(LEGACY_AUTH_KEY);
  } catch {
    // Private mode / storage disabled
  }
}

/**
 * Reads the active role assigned to this browser tab (from sessionStorage).
 */
export function readTabRole(): AuthRole | null {
  try {
    if (typeof window === "undefined" || typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(TAB_ROLE_KEY);
    if (raw && isRole(raw)) return raw;
    return null;
  } catch {
    return null;
  }
}

/**
 * Writes the active role for this browser tab into sessionStorage.
 */
export function writeTabRole(role: AuthRole | null): void {
  try {
    if (typeof window === "undefined" || typeof sessionStorage === "undefined") return;
    if (!role) {
      sessionStorage.removeItem(TAB_ROLE_KEY);
    } else {
      sessionStorage.setItem(TAB_ROLE_KEY, role);
    }
  } catch {
    // ignore
  }
}

/**
 * Legacy compatibility functions.
 */
export function readPersistedSessionAuth(): PersistedSessionAuth | null {
  const tokens = readPersistedTokens();
  const tabRole = readTabRole();

  if (tabRole && tokens[tabRole]) {
    return { v: 1, role: tabRole, accessToken: tokens[tabRole]! };
  }
  if (tokens.user) return { v: 1, role: "user", accessToken: tokens.user };
  if (tokens.mentor) return { v: 1, role: "mentor", accessToken: tokens.mentor };
  if (tokens.admin) return { v: 1, role: "admin", accessToken: tokens.admin };
  return null;
}

export function writePersistedSessionAuth(entry: PersistedSessionAuth | null): void {
  if (!entry) {
    const tabRole = readTabRole();
    if (tabRole) {
      savePersistedRoleToken(tabRole, null);
      writeTabRole(null);
    }
    return;
  }
  savePersistedRoleToken(entry.role, entry.accessToken);
  writeTabRole(entry.role);
}
