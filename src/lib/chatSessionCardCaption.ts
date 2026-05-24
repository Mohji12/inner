import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";

const END_DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

export type ChatCardCaptionRole = "user" | "mentor";

/**
 * Copy for appointments / inbox cards. Booking-paid chats set `ends_at` to the
 * booked session end (`_mark_booking_paid`). "Talk now" chats use purchased minutes instead.
 */
export function chatSessionCardCaption(
  args: {
    ends_at: string;
    remaining_seconds: number;
    status: string;
    role: ChatCardCaptionRole;
  },
  displayTimeZone: string | null | undefined,
): { primaryLine: string; secondaryLine?: string } {
  const { ends_at, remaining_seconds: rs, status, role } = args;
  const endUtc = new Date(ends_at);
  const dateStr = formatDateLocal(endUtc, END_DATE_OPTS, displayTimeZone);
  const timeStr = formatTimeLocal(endUtc, undefined, displayTimeZone);
  const blob = `${dateStr} · ${timeStr}`;
  const minsLeft = rs > 0 ? Math.max(1, Math.ceil(rs / 60)) : 0;

  if (status === "ended") {
    return {
      primaryLine: `Ended ${blob}`,
    };
  }

  if (status === "active" && rs > 0) {
    return {
      primaryLine: `Live until ${blob}`,
      secondaryLine:
        role === "user"
          ? `About ${minsLeft} min left. Paid bookings lock chat until your scheduled session end—not “minutes from now”.`
          : `About ${minsLeft} min left (normally the participant’s booked session end time).`,
    };
  }

  if (rs > 0) {
    return {
      primaryLine: `Through ${blob}`,
      secondaryLine: `About ${minsLeft} min left on the timer.`,
    };
  }

  return {
    primaryLine: `Chat window ended ${blob}`,
    secondaryLine:
      status === "paused"
        ? "No time remaining, so messaging is paused. Open the chatroom for history."
        : undefined,
  };
}
