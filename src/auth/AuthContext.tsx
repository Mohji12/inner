import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { configureApiAuth, inferRoleFromPath, type AuthRole } from "@/api/client";
import type { AccessTokenResponse } from "@/api/types";
import {
  readPersistedTokens,
  savePersistedRoleToken,
  readTabRole,
  writeTabRole,
  type PersistedAuthTokens,
} from "@/auth/authSessionStorage";
import {
  loginAdmin,
  loginMentor,
  loginUser,
  logoutAdmin,
  logoutMentor,
  logoutUser,
  type LoginResponse,
  type MentorLoginBody,
  type UserLoginBody,
} from "@/api/auth";

export type { AuthRole };

type AuthContextValue = {
  role: AuthRole | null;
  userAccessToken: string | null;
  mentorAccessToken: string | null;
  adminAccessToken: string | null;
  setActiveRole: (role: AuthRole | null) => void;
  setUserSession: (token: string | null) => void;
  setMentorSession: (token: string | null) => void;
  setAdminSession: (token: string | null) => void;
  loginUserSession: (body: UserLoginBody) => Promise<LoginResponse>;
  loginMentorSession: (body: MentorLoginBody) => Promise<LoginResponse>;
  loginAdminSession: (body: UserLoginBody) => Promise<AccessTokenResponse>;
  logoutUserSession: () => Promise<void>;
  logoutMentorSession: () => Promise<void>;
  logoutAdminSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function detectInitialRole(tokens: PersistedAuthTokens): AuthRole | null {
  if (typeof window === "undefined") return null;

  // 1. Path-based role detection (strongest signal for tab purpose)
  const pathname = window.location.pathname;
  if (pathname.startsWith("/admin") && tokens.admin) return "admin";
  if (pathname.startsWith("/mentor") && tokens.mentor) return "mentor";
  if ((pathname.startsWith("/user") || pathname.startsWith("/payment")) && tokens.user) return "user";

  // 2. Query param role (e.g. /login?role=mentor)
  try {
    const params = new URLSearchParams(window.location.search);
    const qRole = params.get("role") as AuthRole | null;
    if (qRole && (qRole === "user" || qRole === "mentor" || qRole === "admin")) {
      if (tokens[qRole]) return qRole;
    }
  } catch {
    // ignore
  }

  // 3. Tab-specific role stored in sessionStorage
  const tabRole = readTabRole();
  if (tabRole && tokens[tabRole]) return tabRole;

  // 4. No fallback to an arbitrary saved token.
  // A fresh tab on the public homepage must stay role-neutral so the user can
  // open Login and sign in as coach/admin without being locked to "User hub".
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<PersistedAuthTokens>(() => {
    if (typeof window === "undefined") return { v: 2, user: null, mentor: null, admin: null };
    return readPersistedTokens();
  });

  const [role, setRole] = useState<AuthRole | null>(() => detectInitialRole(tokens));

  const roleRef = useRef<AuthRole | null>(role);
  const userTokenRef = useRef<string | null>(tokens.user);
  const mentorTokenRef = useRef<string | null>(tokens.mentor);
  const adminTokenRef = useRef<string | null>(tokens.admin);

  roleRef.current = role;
  userTokenRef.current = tokens.user;
  mentorTokenRef.current = tokens.mentor;
  adminTokenRef.current = tokens.admin;

  // Update sessionStorage whenever this tab's active role changes
  useEffect(() => {
    writeTabRole(role);
  }, [role]);

  // Synchronize across browser tabs when localStorage changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === "inner_path_auth_tokens_v2") {
        const latest = readPersistedTokens();
        setTokens(latest);
        userTokenRef.current = latest.user;
        mentorTokenRef.current = latest.mentor;
        adminTokenRef.current = latest.admin;

        // If the active role of this tab had its token revoked, re-evaluate tab role
        setRole((curRole) => {
          if (curRole && !latest[curRole]) {
            return detectInitialRole(latest);
          }
          return curRole;
        });
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useLayoutEffect(() => {
    configureApiAuth({
      getAccessToken: (targetPath?: string) => {
        const pathRole = inferRoleFromPath(targetPath);
        if (pathRole === "user") return userTokenRef.current;
        if (pathRole === "mentor") return mentorTokenRef.current;
        if (pathRole === "admin") return adminTokenRef.current;

        const currentRole = roleRef.current;
        if (currentRole === "user") return userTokenRef.current;
        if (currentRole === "mentor") return mentorTokenRef.current;
        if (currentRole === "admin") return adminTokenRef.current;

        // Fallbacks
        if (mentorTokenRef.current) return mentorTokenRef.current;
        if (adminTokenRef.current) return adminTokenRef.current;
        if (userTokenRef.current) return userTokenRef.current;
        return null;
      },
      getRole: (targetPath?: string) => {
        const pathRole = inferRoleFromPath(targetPath);
        if (pathRole) return pathRole;
        const currentRole = roleRef.current;
        if (currentRole) return currentRole;
        if (mentorTokenRef.current) return "mentor";
        if (adminTokenRef.current) return "admin";
        if (userTokenRef.current) return "user";
        return null;
      },
      setAccessToken: (token: string | null, targetRole?: AuthRole) => {
        const r = targetRole || roleRef.current || "user";
        savePersistedRoleToken(r, token);
        setTokens((prev) => ({ ...prev, [r]: token }));
        if (r === "user") userTokenRef.current = token;
        if (r === "mentor") mentorTokenRef.current = token;
        if (r === "admin") adminTokenRef.current = token;

        if (!token && roleRef.current === r) {
          setRole(null);
          writeTabRole(null);
        }
      },
    });
  }, []);

  const setActiveRole = useCallback((newRole: AuthRole | null) => {
    setRole(newRole);
    writeTabRole(newRole);
  }, []);

  const setUserSession = useCallback((token: string | null) => {
    userTokenRef.current = token;
    savePersistedRoleToken("user", token);
    setTokens((prev) => ({ ...prev, user: token }));
    if (token) {
      setRole("user");
      writeTabRole("user");
    } else if (roleRef.current === "user") {
      setRole(null);
      writeTabRole(null);
    }
  }, []);

  const setMentorSession = useCallback((token: string | null) => {
    mentorTokenRef.current = token;
    savePersistedRoleToken("mentor", token);
    setTokens((prev) => ({ ...prev, mentor: token }));
    if (token) {
      setRole("mentor");
      writeTabRole("mentor");
    } else if (roleRef.current === "mentor") {
      setRole(null);
      writeTabRole(null);
    }
  }, []);

  const setAdminSession = useCallback((token: string | null) => {
    adminTokenRef.current = token;
    savePersistedRoleToken("admin", token);
    setTokens((prev) => ({ ...prev, admin: token }));
    if (token) {
      setRole("admin");
      writeTabRole("admin");
    } else if (roleRef.current === "admin") {
      setRole(null);
      writeTabRole(null);
    }
  }, []);

  const loginUserSession = useCallback(
    async (body: UserLoginBody) => {
      const res = await loginUser(body);
      if (!res.two_factor_required) {
        setUserSession(res.access_token);
      }
      return res;
    },
    [setUserSession],
  );

  const loginMentorSession = useCallback(
    async (body: MentorLoginBody) => {
      const res = await loginMentor(body);
      if (!res.two_factor_required) {
        setMentorSession(res.access_token);
      }
      return res;
    },
    [setMentorSession],
  );

  const loginAdminSession = useCallback(
    async (body: UserLoginBody) => {
      const res = await loginAdmin(body);
      setAdminSession(res.access_token);
      return res;
    },
    [setAdminSession],
  );

  const logoutUserSession = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setUserSession(null);
    }
  }, [setUserSession]);

  const logoutMentorSession = useCallback(async () => {
    try {
      await logoutMentor();
    } finally {
      setMentorSession(null);
      try {
        sessionStorage.removeItem("coach_online_toast_shown");
      } catch {
        /* ignore */
      }
    }
  }, [setMentorSession]);

  const logoutAdminSession = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      setAdminSession(null);
    }
  }, [setAdminSession]);

  const value = useMemo(
    () => ({
      role,
      userAccessToken: tokens.user,
      mentorAccessToken: tokens.mentor,
      adminAccessToken: tokens.admin,
      setActiveRole,
      setUserSession,
      setMentorSession,
      setAdminSession,
      loginUserSession,
      loginMentorSession,
      loginAdminSession,
      logoutUserSession,
      logoutMentorSession,
      logoutAdminSession,
    }),
    [
      role,
      tokens.user,
      tokens.mentor,
      tokens.admin,
      setActiveRole,
      setUserSession,
      setMentorSession,
      setAdminSession,
      loginUserSession,
      loginMentorSession,
      loginAdminSession,
      logoutUserSession,
      logoutMentorSession,
      logoutAdminSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Non-throwing auth access — use in global listeners (heartbeats) to survive Vite HMR remounts. */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
