import type { Booking, ChatInboxSession } from "@/api/types";

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

export function isCurrentBooking(booking: Pick<Booking, "status" | "payment_status" | "end_at_utc">, now = new Date()): boolean {
  if (booking.status !== "confirmed" || booking.payment_status !== "paid") return false;
  return new Date(booking.end_at_utc).getTime() >= now.getTime();
}

/** Paid live booking with an open chat room — use linked chat timer when booking end time is stale. */
export function canOpenBookingChat(
  booking: Pick<Booking, "status" | "payment_status" | "end_at_utc" | "meeting_link">,
  linkedChat?: Pick<ChatInboxSession, "status" | "remaining_seconds"> | null,
  now = new Date(),
): boolean {
  if (booking.status !== "confirmed" || booking.payment_status !== "paid" || !booking.meeting_link) {
    return false;
  }
  if (linkedChat?.status === "ended") return false;
  if (isCurrentBooking(booking, now)) return true;
  if (!linkedChat || linkedChat.remaining_seconds <= 0) return false;
  return linkedChat.status === "paused" || linkedChat.status === "active";
}

/** True when the booked session window or linked live chat has finished. */
export function isBookingSessionEnded(
  booking: Pick<Booking, "status" | "payment_status" | "end_at_utc">,
  linkedChat?: Pick<ChatInboxSession, "status" | "remaining_seconds"> | null,
  now = new Date(),
): boolean {
  if (booking.status === "completed") return true;
  if (booking.status !== "confirmed" || booking.payment_status !== "paid") return false;
  if (linkedChat?.status === "ended") return true;
  if (new Date(booking.end_at_utc).getTime() <= now.getTime()) return true;
  if (
    linkedChat &&
    linkedChat.remaining_seconds <= 0 &&
    linkedChat.status !== "active" &&
    linkedChat.status !== "paused"
  ) {
    return true;
  }
  return false;
}

/** Paid booking whose session is over — eligible for booking PDF invoice download. */
export function canDownloadBookingInvoice(
  booking: Pick<Booking, "status" | "payment_status" | "end_at_utc">,
  linkedChat?: Pick<ChatInboxSession, "status" | "remaining_seconds"> | null,
  now = new Date(),
): boolean {
  if (booking.payment_status !== "paid") return false;
  if (booking.status === "completed") return true;
  return booking.status === "confirmed" && isBookingSessionEnded(booking, linkedChat, now);
}

export function sortBookingsForDisplay<T extends Pick<Booking, "status" | "payment_status" | "start_at_utc" | "end_at_utc">>(
  bookings: T[],
): T[] {
  const now = Date.now();
  return [...bookings].sort((a, b) => {
    const aCurrent = isCurrentBooking(a, new Date(now));
    const bCurrent = isCurrentBooking(b, new Date(now));
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
    return new Date(b.start_at_utc).getTime() - new Date(a.start_at_utc).getTime();
  });
}

export function chatSessionById(sessions: ChatInboxSession[]): Map<string, ChatInboxSession> {
  return new Map(sessions.map((session) => [session.id, session]));
}
