import { API_V1_PREFIX, getApiBaseUrl } from "./constants";
import type { AccessTokenResponse } from "./types";

export type AuthRole = "user" | "mentor" | "admin";

type TokenSetter = (token: string | null) => void;

let getAccessToken: () => string | null = () => null;
let getAuthRole: () => AuthRole | null = () => null;
let setAccessTokenForRole: TokenSetter = () => {};

let refreshInFlight: Promise<string | null> | null = null;

function getSelectedLanguage(): string {
  const raw = typeof window !== "undefined" ? localStorage.getItem("lang") : null;
  const lang = (raw || "en").toLowerCase();
  return lang.split("-")[0];
}

export function configureApiAuth(accessors: {
  getAccessToken: () => string | null;
  getRole: () => AuthRole | null;
  setAccessToken: TokenSetter;
}): void {
  getAccessToken = accessors.getAccessToken;
  getAuthRole = accessors.getRole;
  setAccessTokenForRole = accessors.setAccessToken;
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    const { detail } = data;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && !Array.isArray(detail)) {
      const d = detail as { message?: string; msg?: string };
      if (typeof d.message === "string") return d.message;
      if (typeof d.msg === "string") return d.msg;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item: { msg?: string }) => item?.msg)
        .filter(Boolean)
        .join(", ");
    }
    return response.statusText;
  } catch {
    return response.statusText;
  }
}

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${API_V1_PREFIX}${p}`;
}

async function refreshAccessToken(): Promise<string | null> {
  const role = getAuthRole();
  if (!role) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const res = await fetch(buildUrl(`/auth/${role}/refresh`), {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      setAccessTokenForRole(null);
      return null;
    }
    const body = (await res.json()) as AccessTokenResponse;
    setAccessTokenForRole(body.access_token);
    return body.access_token;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export type ApiFetchOptions = RequestInit & {
  /** Skip Authorization header and 401 refresh (e.g. login). */
  skipAuth?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, ...init } = options;
  const url = buildUrl(path);
  const headers = new Headers(init.headers);

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Accept-Language")) headers.set("Accept-Language", getSelectedLanguage());

  const hasBody = init.body !== undefined && init.body !== null;
  if (hasBody && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const exec = () =>
    fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });

  let response = await exec();

  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await exec();
    } else {
      setAccessTokenForRole(null);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response));
  }

  return response.json() as Promise<T>;
}

export type ApiFetchBlobResult = { blob: Blob; filename: string | null };

/** Authenticated GET returning binary (e.g. PDF). Parses filename from Content-Disposition when present. */
export async function apiFetchBlob(path: string, options: ApiFetchOptions = {}): Promise<ApiFetchBlobResult> {
  const { skipAuth, ...init } = options;
  const url = buildUrl(path);
  const headers = new Headers(init.headers);

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Accept-Language")) headers.set("Accept-Language", getSelectedLanguage());

  const exec = () =>
    fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });

  let response = await exec();

  if (response.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await exec();
    } else {
      setAccessTokenForRole(null);
    }
  }

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response));
  }

  const blob = await response.blob();
  const cd = response.headers.get("Content-Disposition");
  let filename: string | null = null;
  if (cd) {
    const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
    const quoted = /filename="([^"]+)"/i.exec(cd);
    const plain = /filename=([^;\s]+)/i.exec(cd);
    const raw = star?.[1]?.trim() ?? quoted?.[1] ?? plain?.[1];
    if (raw) {
      try {
        filename = decodeURIComponent(raw.replace(/^"|"$/g, ""));
      } catch {
        filename = raw.replace(/^"|"$/g, "");
      }
    }
  }
  return { blob, filename };
}
