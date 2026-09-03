import type { Booking, ChatInboxSession } from "@/api/types";
import {
  sessionJoinWindowExpired,
  sessionNeedsInitialPayment,
  sessionTimeExpired,
  sessionWaitingForParticipants,
} from "@/lib/chatSessionTiming";

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
  const start = new Date(booking.start_at_utc).getTime();
  const end = new Date(booking.end_at_utc).getTime();
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
    if (new Date(booking.end_at_utc).getTime() <= now.getTime()) return true;
  }
  if (new Date(booking.end_at_utc).getTime() <= now.getTime()) return true;
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
    return new Date(b.start_at_utc).getTime() - new Date(a.start_at_utc).getTime();
  });
}

export function chatSessionById(sessions: ChatInboxSession[]): Map<string, ChatInboxSession> {
  const map = new Map<string, ChatInboxSession>();
  for (const session of sessions) {
    map.set(session.id, session);
  }
  return map;
}
