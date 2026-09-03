import { apiFetch } from "./client";

export type SupportRole = "user" | "coach" | "other";

export interface PublicSupportBody {
  full_name: string;
  email: string;
  phone?: string | null;
  role: SupportRole;
  subject: string;
  message: string;
}

export interface AuthenticatedSupportBody {
  subject: string;
  message: string;
  phone?: string | null;
}

export interface SupportMessageOut {
  message: string;
}

export function submitPublicSupport(body: PublicSupportBody): Promise<SupportMessageOut> {
  return apiFetch<SupportMessageOut>("/contact/support", {
    method: "POST",
    body: JSON.stringify(body),
    skipAuth: true,
  });
}

export function submitUserSupport(body: AuthenticatedSupportBody): Promise<SupportMessageOut> {
  return apiFetch<SupportMessageOut>("/users/me/support", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitMentorSupport(body: AuthenticatedSupportBody): Promise<SupportMessageOut> {
  return apiFetch<SupportMessageOut>("/mentors/me/support", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
