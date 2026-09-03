import type { ChatSession } from "@/api/types";

export type SessionTiming = Pick<
  ChatSession,
  "status" | "timer_started" | "remaining_seconds" | "waiting_for" | "allocated_duration_minutes"
>;

/** Flexible chat created at checkout but never paid — not the same as time running out. */
export function sessionNeedsInitialPayment(session: SessionTiming | null | undefined): boolean {
  if (!session) return false;
  if (session.status === "ended" || session.status === "active") return false;
  if (session.timer_started) return false;
  if (session.waiting_for) return false;
  if ((session.allocated_duration_minutes ?? 0) > 0) return false;
  return session.status === "paused" && session.remaining_seconds <= 0;
}

/** Paid time started and then hit zero (still extendable until permanently ended). */
export function sessionTimeExpired(session: SessionTiming | null | undefined): boolean {
  if (!session) return false;
  if (session.status === "ended") return false;
  return Boolean(session.timer_started) && session.remaining_seconds <= 0;
}

/**
 * Paid booking where both parties never joined before the join deadline.
 * allocated minutes set, timer never started, rem=0, waiting_for cleared.
 */
export function sessionJoinWindowExpired(session: SessionTiming | null | undefined): boolean {
  if (!session) return false;
  if (session.status === "ended" || session.status === "active") return false;
  if (session.timer_started) return false;
  if (session.waiting_for) return false;
  if ((session.allocated_duration_minutes ?? 0) <= 0) return false;
  return session.remaining_seconds <= 0;
}

/** Booking session waiting for one or both participants (timer not started, time reserved). */
export function sessionWaitingForParticipants(session: SessionTiming | null | undefined): boolean {
  if (!session) return false;
  if (session.status === "ended") return false;
  if (session.timer_started) return false;
  if (session.remaining_seconds <= 0) return false;
  return Boolean(session.waiting_for) || (session.allocated_duration_minutes ?? 0) > 0;
}

/** Align with backend session_allows_messaging for the chat composer. */
export function sessionAllowsMessaging(session: SessionTiming | null | undefined): boolean {
  if (!session) return false;
  if (session.status === "ended") return false;
  if (session.status === "active" && session.remaining_seconds > 0) return true;
  // Pre-timer booking window: messaging allowed while join window is open.
  if (
    !session.timer_started &&
    (session.allocated_duration_minutes ?? 0) > 0 &&
    session.remaining_seconds > 0
  ) {
    return true;
  }
  return false;
}
