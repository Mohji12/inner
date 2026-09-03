import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import {
  sessionJoinWindowExpired,
  sessionNeedsInitialPayment,
  sessionTimeExpired,
  sessionWaitingForParticipants,
  type SessionTiming,
} from "@/lib/chatSessionTiming";

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
    timer_started?: boolean;
    waiting_for?: SessionTiming["waiting_for"];
    allocated_duration_minutes?: number | null;
  },
  displayTimeZone: string | null | undefined,
): { primaryLine: string; secondaryLine?: string } {
  const { ends_at, remaining_seconds: rs, status, role } = args;
  const timing: SessionTiming = {
    status,
    timer_started: Boolean(args.timer_started),
    remaining_seconds: rs,
    waiting_for: args.waiting_for ?? null,
    allocated_duration_minutes: args.allocated_duration_minutes ?? null,
  };
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

  if (sessionNeedsInitialPayment(timing)) {
    return {
      primaryLine: "Payment required",
      secondaryLine:
        role === "user"
          ? "Checkout was not completed. Open the chatroom and pay to start."
          : "Waiting for the client to complete payment.",
    };
  }

  if (sessionJoinWindowExpired(timing)) {
    return {
      primaryLine: `Join window expired ${blob}`,
      secondaryLine:
        role === "user"
          ? "Neither of you joined in time. Pay to continue this same chat, or book again."
          : "Join window closed. Client can pay to continue or book again.",
    };
  }

  if (sessionTimeExpired(timing)) {
    return {
      primaryLine: `Time up ${blob}`,
      secondaryLine:
        status === "paused"
          ? "No time remaining. Open the chatroom to buy more minutes or view history."
          : undefined,
    };
  }

  if (sessionWaitingForParticipants(timing)) {
    const who =
      timing.waiting_for === "mentor"
        ? role === "mentor"
          ? "Waiting for you"
          : "Waiting for coach"
        : timing.waiting_for === "user"
          ? role === "user"
            ? "Waiting for you"
            : "Waiting for user"
          : "Waiting for both of you";
    return {
      primaryLine: `${who} · ${minsLeft} min reserved`,
      secondaryLine: `Join by ${blob}. Timer starts when both are in the room.`,
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
      secondaryLine: `About ${minsLeft} min left.`,
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

/** Short CTA label for standalone chat cards on appointments. */
export function chatSessionOpenLabel(session: SessionTiming): string {
  if (session.status === "active") return "Open chatroom";
  if (sessionNeedsInitialPayment(session)) return "Pay to start";
  if (sessionJoinWindowExpired(session) || sessionTimeExpired(session) || session.status === "ended") {
    return "Continue chat";
  }
  if (sessionWaitingForParticipants(session)) return "Open chatroom (waiting)";
  if (session.status === "paused") return "Open chatroom (paused)";
  return "Open chatroom";
}
