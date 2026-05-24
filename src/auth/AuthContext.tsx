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
import { configureApiAuth, type AuthRole } from "@/api/client";
import type { AccessTokenResponse } from "@/api/types";
import { readPersistedSessionAuth, writePersistedSessionAuth } from "@/auth/authSessionStorage";
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

function loadPersistedSession(): {
  role: AuthRole | null;
  user: string | null;
  mentor: string | null;
  admin: string | null;
} {
  if (typeof window === "undefined") {
    return { role: null, user: null, mentor: null, admin: null };
  }
  const p = readPersistedSessionAuth();
  if (!p) return { role: null, user: null, mentor: null, admin: null };
  if (p.role === "user") {
    return { role: "user", user: p.accessToken, mentor: null, admin: null };
  }
  if (p.role === "mentor") {
    return { role: "mentor", user: null, mentor: p.accessToken, admin: null };
  }
  return { role: "admin", user: null, mentor: null, admin: p.accessToken };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const persisted = typeof window !== "undefined" ? loadPersistedSession() : null;

  const [role, setRole] = useState<AuthRole | null>(() => persisted?.role ?? null);
  const [userAccessToken, setUserAccessToken] = useState<string | null>(() => persisted?.user ?? null);
  const [mentorAccessToken, setMentorAccessToken] = useState<string | null>(() => persisted?.mentor ?? null);
  const [adminAccessToken, setAdminAccessToken] = useState<string | null>(() => persisted?.admin ?? null);

  const roleRef = useRef<AuthRole | null>(null);
  const userTokenRef = useRef<string | null>(null);
  const mentorTokenRef = useRef<string | null>(null);
  const adminTokenRef = useRef<string | null>(null);

  roleRef.current = role;
  userTokenRef.current = userAccessToken;
  mentorTokenRef.current = mentorAccessToken;
  adminTokenRef.current = adminAccessToken;

  useEffect(() => {
    const hasToken =
      role === "user"
        ? Boolean(userAccessToken)
        : role === "mentor"
          ? Boolean(mentorAccessToken)
          : role === "admin"
            ? Boolean(adminAccessToken)
            : false;

    if (!role || !hasToken) {
      writePersistedSessionAuth(null);
      return;
    }
    const token =
      role === "user" ? userAccessToken : role === "mentor" ? mentorAccessToken : adminAccessToken;
    if (!token) {
      writePersistedSessionAuth(null);
      return;
    }
    writePersistedSessionAuth({ v: 1, role, accessToken: token });
  }, [role, userAccessToken, mentorAccessToken, adminAccessToken]);

  useLayoutEffect(() => {
    configureApiAuth({
      getAccessToken: () => {
        const r = roleRef.current;
        if (r === "user") return userTokenRef.current;
        if (r === "mentor") return mentorTokenRef.current;
        if (r === "admin") return adminTokenRef.current;
        // After login*Session sets token refs, `role` state (and thus roleRef) may not
        // update until the next render — same-tick apiFetch still needs the Bearer token.
        if (userTokenRef.current) return userTokenRef.current;
        if (mentorTokenRef.current) return mentorTokenRef.current;
        if (adminTokenRef.current) return adminTokenRef.current;
        return null;
      },
      getRole: () => {
        const r = roleRef.current;
        if (r) return r;
        if (userTokenRef.current) return "user";
        if (mentorTokenRef.current) return "mentor";
        if (adminTokenRef.current) return "admin";
        return null;
      },
      setAccessToken: (token) => {
        let r = roleRef.current;
        if (!r) {
          if (userTokenRef.current) r = "user";
          else if (mentorTokenRef.current) r = "mentor";
          else if (adminTokenRef.current) r = "admin";
        }
        if (r === "user") {
          userTokenRef.current = token;
          setUserAccessToken(token);
        } else if (r === "mentor") {
          mentorTokenRef.current = token;
          setMentorAccessToken(token);
        } else if (r === "admin") {
          adminTokenRef.current = token;
          setAdminAccessToken(token);
        }
      },
    });
  }, []);

  const setUserSession = useCallback((token: string | null) => {
    userTokenRef.current = token;
    setUserAccessToken(token);
    if (token) {
      mentorTokenRef.current = null;
      setMentorAccessToken(null);
      adminTokenRef.current = null;
      setAdminAccessToken(null);
      setRole("user");
    } else if (roleRef.current === "user") {
      setRole(null);
    }
  }, []);

  const setMentorSession = useCallback((token: string | null) => {
    mentorTokenRef.current = token;
    setMentorAccessToken(token);
    if (token) {
      userTokenRef.current = null;
      setUserAccessToken(null);
      adminTokenRef.current = null;
      setAdminAccessToken(null);
      setRole("mentor");
    } else if (roleRef.current === "mentor") {
      setRole(null);
    }
  }, []);

  const setAdminSession = useCallback((token: string | null) => {
    adminTokenRef.current = token;
    setAdminAccessToken(token);
    if (token) {
      userTokenRef.current = null;
      setUserAccessToken(null);
      mentorTokenRef.current = null;
      setMentorAccessToken(null);
      setRole("admin");
    } else if (roleRef.current === "admin") {
      setRole(null);
    }
  }, []);

  const loginUserSession = useCallback(async (body: UserLoginBody) => {
    const res = await loginUser(body);
    if (!res.two_factor_required) {
      userTokenRef.current = res.access_token;
      mentorTokenRef.current = null;
      adminTokenRef.current = null;
      setUserAccessToken(res.access_token);
      setMentorAccessToken(null);
      setAdminAccessToken(null);
      setRole("user");
    }
    return res;
  }, []);

  const loginMentorSession = useCallback(async (body: MentorLoginBody) => {
    const res = await loginMentor(body);
    if (!res.two_factor_required) {
      mentorTokenRef.current = res.access_token;
      userTokenRef.current = null;
      adminTokenRef.current = null;
      setMentorAccessToken(res.access_token);
      setUserAccessToken(null);
      setAdminAccessToken(null);
      setRole("mentor");
    }
    return res;
  }, []);

  const loginAdminSession = useCallback(async (body: UserLoginBody) => {
    const res = await loginAdmin(body);
    adminTokenRef.current = res.access_token;
    userTokenRef.current = null;
    mentorTokenRef.current = null;
    setAdminAccessToken(res.access_token);
    setUserAccessToken(null);
    setMentorAccessToken(null);
    setRole("admin");
    return res;
  }, []);

  const logoutUserSession = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      userTokenRef.current = null;
      setUserAccessToken(null);
      if (roleRef.current === "user") setRole(null);
    }
  }, []);

  const logoutMentorSession = useCallback(async () => {
    try {
      await logoutMentor();
    } finally {
      mentorTokenRef.current = null;
      setMentorAccessToken(null);
      if (roleRef.current === "mentor") setRole(null);
    }
  }, []);

  const logoutAdminSession = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      adminTokenRef.current = null;
      setAdminAccessToken(null);
      if (roleRef.current === "admin") setRole(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      role,
      userAccessToken,
      mentorAccessToken,
      adminAccessToken,
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
      userAccessToken,
      mentorAccessToken,
      adminAccessToken,
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
