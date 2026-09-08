import type { Booking, ChatInboxSession } from "@/api/types";
import {
  sessionJoinWindowExpired,
  sessionNeedsInitialPayment,
  sessionTimeExpired,
  sessionWaitingForParticipants,
} from "@/lib/chatSessionTiming";
import { parseApiUtcDate } from "@/lib/timeZone";

/** Extract chat session id from a booking meeting link (`/user/chat/{id}` or `/mentor/chat/{id}`). */
export function meetingLinkSessionId(link: string | null | undefined): string | null {
  if (!link) return null;
  const match = link.match(/\/(?:user|mentor)\/chat\/([^/?#]+)/i);
  return match?.[1]?.trim() ?? null;
}

export function bookingLinkedSessionIds(bookings: Pick<Booking, "meeting_link">[]): Set<string> {
  const ids = new Set<string>();
  for (const booking of bookings) {
    const sessionId = meetingLinkSessionId(booking.meeting_link);
    if (sessionId) ids.add(sessionId);
  }
  return ids;
}

/** Instant-chat sessions only — exclude ones already shown on a paid booking card. */
export function standaloneChatSessions(
  sessions: ChatInboxSession[],
  bookings: Pick<Booking, "meeting_link">[],
): ChatInboxSession[] {
  const linked = bookingLinkedSessionIds(bookings);
  return sessions.filter((session) => !linked.has(session.id));
}

type BookingTime = Pick<Booking, "status" | "payment_status" | "start_at_utc" | "end_at_utc">;

/** Paid booking whose scheduled window is currently underway (not future, not past). */
export function isCurrentBooking(booking: BookingTime, now = new Date()): boolean {
  if (booking.status !== "confirmed" || booking.payment_status !== "paid") return false;
  const start = parseApiUtcDate(booking.start_at_utc).getTime();
  const end = parseApiUtcDate(booking.end_at_utc).getTime();
  const t = now.getTime();
  return start <= t && t <= end;
}

type LinkedChat = Pick<
  ChatInboxSession,
  "status" | "remaining_seconds" | "timer_started" | "waiting_for" | "allocated_duration_minutes"
>;

/** Paid live booking with an open chat room — respect join window and timers. */
export function canOpenBookingChat(
  booking: Pick<Booking, "status" | "payment_status" | "end_at_utc" | "start_at_utc" | "meeting_link">,
  linkedChat?: LinkedChat | null,
  now = new Date(),
): boolean {
  if (booking.status !== "confirmed" || booking.payment_status !== "paid" || !booking.meeting_link) {
    return false;
  }
  if (linkedChat?.status === "ended") return false;
  if (sessionNeedsInitialPayment(linkedChat)) return false;
  if (sessionJoinWindowExpired(linkedChat)) return false;
  if (sessionTimeExpired(linkedChat)) return false;

  if (linkedChat) {
    if (sessionWaitingForParticipants(linkedChat)) return true;
    if (linkedChat.remaining_seconds > 0 && (linkedChat.status === "paused" || linkedChat.status === "active")) {
      return true;
    }
  }

  // No linked chat yet, or still within scheduled window — allow open.
  if (isCurrentBooking(booking, now)) return true;
  return false;
}

/** True when the booked session window or linked live chat has finished. */
export function isBookingSessionEnded(
  booking: Pick<Booking, "status" | "payment_status" | "end_at_utc">,
  linkedChat?: LinkedChat | null,
  now = new Date(),
): boolean {
  if (booking.status === "completed") return true;
  if (booking.status !== "confirmed" || booking.payment_status !== "paid") return false;
  if (linkedChat?.status === "ended") return true;
  if (sessionJoinWindowExpired(linkedChat) || sessionTimeExpired(linkedChat)) {
    // Join miss / time-up: booking window may still be "current" by clock — treat as ended for invoice UI.
    if (parseApiUtcDate(booking.end_at_utc).getTime() <= now.getTime()) return true;
  }
  if (parseApiUtcDate(booking.end_at_utc).getTime() <= now.getTime()) return true;
  return false;
}

/** Paid booking whose session is over — eligible for booking PDF invoice download. */
export function canDownloadBookingInvoice(
  booking: Pick<Booking, "status" | "payment_status" | "end_at_utc">,
  linkedChat?: LinkedChat | null,
  now = new Date(),
): boolean {
  if (booking.payment_status !== "paid") return false;
  if (booking.status === "completed") return true;
  return booking.status === "confirmed" && isBookingSessionEnded(booking, linkedChat, now);
}

export function sortBookingsForDisplay<T extends Pick<Booking, "status" | "payment_status" | "start_at_utc" | "end_at_utc">>(
  bookings: T[],
  now = new Date(),
): T[] {
  return [...bookings].sort((a, b) => {
    const aCurrent = isCurrentBooking(a, now) ? 0 : 1;
    const bCurrent = isCurrentBooking(b, now) ? 0 : 1;
    if (aCurrent !== bCurrent) return aCurrent - bCurrent;
    return parseApiUtcDate(b.start_at_utc).getTime() - parseApiUtcDate(a.start_at_utc).getTime();
  });
}

export function chatSessionById(sessions: ChatInboxSession[]): Map<string, ChatInboxSession> {
  const map = new Map<string, ChatInboxSession>();
  for (const session of sessions) {
    map.set(session.id, session);
  }
  return map;
}

export type MentorLiveJoinTarget = {
  sessionId: string;
  path: string;
  partnerName?: string;
  /** True when the client is waiting for the coach to enter. */
  waitingForCoach: boolean;
};

/**
 * Best live room for a coach dashboard “Join session” CTA.
 * Prefers API active/me, then joinable paid bookings, then live instant chat.
 */
export function resolveMentorLiveJoinTarget(opts: {
  activeSession: Pick<
    ChatInboxSession,
    "id" | "status" | "remaining_seconds" | "timer_started" | "waiting_for" | "allocated_duration_minutes"
  > | null;
  bookings: Booking[];
  inbox: ChatInboxSession[];
  now?: Date;
}): MentorLiveJoinTarget | null {
  const now = opts.now ?? new Date();
  const map = chatSessionById(opts.inbox);

  const waitingForCoach = (
    session: Pick<ChatInboxSession, "waiting_for" | "timer_started" | "allocated_duration_minutes" | "status"> | null | undefined,
  ) => {
    if (!session) return false;
    if (session.timer_started) return false;
    return session.waiting_for === "mentor" || session.waiting_for === "both";
  };

  if (opts.activeSession?.id) {
    const inboxHit = map.get(opts.activeSession.id);
    return {
      sessionId: opts.activeSession.id,
      path: `/mentor/chat/${opts.activeSession.id}`,
      partnerName: inboxHit?.partner_name,
      waitingForCoach: waitingForCoach(opts.activeSession) || waitingForCoach(inboxHit),
    };
  }

  for (const booking of sortBookingsForDisplay(opts.bookings, now)) {
    const sessionId = meetingLinkSessionId(booking.meeting_link);
    if (!sessionId) continue;
    const linked = map.get(sessionId);
    if (!canOpenBookingChat(booking, linked, now)) continue;
    return {
      sessionId,
      path: `/mentor/chat/${sessionId}`,
      partnerName: linked?.partner_name,
      waitingForCoach: waitingForCoach(linked) || !linked?.timer_started,
    };
  }

  for (const session of standaloneChatSessions(opts.inbox, opts.bookings)) {
    if (session.status === "ended") continue;
    if (sessionNeedsInitialPayment(session) || sessionJoinWindowExpired(session) || sessionTimeExpired(session)) {
      continue;
    }
    if (session.status === "active" && session.remaining_seconds > 0) {
      return {
        sessionId: session.id,
        path: `/mentor/chat/${session.id}`,
        partnerName: session.partner_name,
        waitingForCoach: false,
      };
    }
    if (sessionWaitingForParticipants(session)) {
      return {
        sessionId: session.id,
        path: `/mentor/chat/${session.id}`,
        partnerName: session.partner_name,
        waitingForCoach: waitingForCoach(session),
      };
    }
  }

  return null;
}
