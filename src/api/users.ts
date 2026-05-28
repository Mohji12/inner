import { apiFetch } from "./client";
import type { UserOut } from "./types";

export type UserPatchBody = Partial<{
  full_name: string;
  profile_image: string | null;
  gender: string | null;
  date_of_birth: string | null;
  location: string | null;
  country_code: string | null;
  timezone: string | null;
  preferred_language: string | null;
  interests: unknown[] | null;
  goals: string | null;
  preferred_categories: unknown[] | null;
  preferred_communication_mode: string | null;
}>;

export function getUserMe(): Promise<UserOut> {
  return apiFetch<UserOut>("/users/me");
}

export function patchUserMe(body: UserPatchBody): Promise<UserOut> {
  return apiFetch<UserOut>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export interface UserDashboardStats {
  upcoming_session?: {
    id: string;
    mentor_name: string;
    date: string;
    start_time: string;
  } | null;
  total_sessions: number;
  total_spent: number;
  active_chats: number;
}

export function getUserDashboardStats(): Promise<UserDashboardStats> {
  return apiFetch<UserDashboardStats>("/users/me/dashboard-stats");
}

export type AnalyticsPeriod = "day" | "week" | "month" | "year";

export interface DateAmountPoint {
  date: string;
  amount: string;
}

export interface UserSpendingSeries {
  period: AnalyticsPeriod;
  range_start: string;
  range_end: string;
  bookings_by_day: DateAmountPoint[];
  chat_by_day: DateAmountPoint[];
}

export function getUserSpendingSeries(period: AnalyticsPeriod): Promise<UserSpendingSeries> {
  return apiFetch<UserSpendingSeries>(`/users/me/spending-series?period=${period}`);
}

export function heartbeatUserPresence(): Promise<void> {
  return apiFetch<void>("/users/me/presence", { method: "POST" });
}

export interface UserPresenceStatus {
  is_online: boolean;
}

export function getUserPresenceStatus(): Promise<UserPresenceStatus> {
  return apiFetch<UserPresenceStatus>("/users/me/presence-status");
}
