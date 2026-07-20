import type { AuthRole } from "@/auth/AuthContext";

const DEFAULT_PATHS: Record<AuthRole, string> = {
  user: "/user/appointments",
  mentor: "/mentor/appointments",
  admin: "/admin",
};

/** Only allow same-origin relative paths (no protocol-relative or external URLs). */
export function sanitizeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) {
    return null;
  }
  if (path.startsWith("/login")) {
    return null;
  }
  return path;
}

export function resolvePostLoginPath(role: AuthRole, from?: unknown): string {
  return sanitizeReturnPath(from) ?? DEFAULT_PATHS[role];
}
