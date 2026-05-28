import type { SessionBookingMeta } from "@/api/types";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";

export function formatCommunicationMode(mode: string | null | undefined): string | null {
  if (!mode) return null;
  const normalized = mode.trim().toLowerCase();
  if (normalized === "video") return "Video";
  if (normalized === "call") return "Phone call";
  return mode;
}

export function formatSessionBookingSummary(
  booking: SessionBookingMeta,
  timeZone?: string | null,
): { primary: string; secondary: string } {
  const date = formatDateLocal(
    booking.start_at_utc,
    { weekday: "short", year: "numeric", month: "short", day: "numeric" },
    timeZone,
  );
  const start = formatTimeLocal(booking.start_at_utc, undefined, timeZone);
  const end = formatTimeLocal(booking.end_at_utc, undefined, timeZone);
  const bookedDate = formatDateLocal(
    booking.booked_at,
    { day: "numeric", month: "short", year: "numeric" },
    timeZone,
  );
  const bookedTime = formatTimeLocal(booking.booked_at, undefined, timeZone);
  const mode = formatCommunicationMode(booking.communication_mode);
  const durationPart = `${booking.duration_minutes} min`;
  const modePart = mode ? ` · ${mode}` : "";
  return {
    primary: `${date} · ${start} – ${end} · ${durationPart}${modePart}`,
    secondary: `Booked ${bookedDate} at ${bookedTime}`,
  };
}

export function formatLiveSessionWindow(
  durationMinutes: number,
  timeZone?: string | null,
  now: Date = new Date(),
): string {
  const end = new Date(now.getTime() + durationMinutes * 60_000);
  const date = formatDateLocal(now, { weekday: "short", month: "short", day: "numeric" }, timeZone);
  const start = formatTimeLocal(now, undefined, timeZone);
  const endTime = formatTimeLocal(end, undefined, timeZone);
  return `${date} · ${start} – ${endTime} · ${durationMinutes} min`;
}
