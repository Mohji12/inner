export function resolveBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function safeTimeZone(timeZone?: string | null): string {
  return timeZone?.trim() || resolveBrowserTimeZone();
}

export function formatDateLocal(
  input: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
  timeZone?: string | null,
): string {
  const date = new Date(input);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimeZone(timeZone),
    ...(opts ?? {}),
  }).format(date);
}

export function formatTimeLocal(
  input: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
  timeZone?: string | null,
): string {
  const date = new Date(input);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimeZone(timeZone),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(opts ?? {}),
  }).format(date);
}

export function formatUtcForViewer(
  utcIso: string | number | Date,
  viewerTz?: string | null,
): { date: string; time: string; dateTime: string } {
  const d = new Date(utcIso);
  const tz = safeTimeZone(viewerTz);
  const date = formatDateLocal(d, { year: "numeric", month: "2-digit", day: "2-digit" }, tz);
  const time = formatTimeLocal(d, undefined, tz);
  return { date, time, dateTime: `${date} ${time}` };
}

export function isSameCalendarDayLocal(
  a: string | number | Date,
  b: string | number | Date,
  timeZone?: string | null,
): boolean {
  return (
    formatDateLocal(a, { year: "numeric", month: "2-digit", day: "2-digit" }, timeZone) ===
    formatDateLocal(b, { year: "numeric", month: "2-digit", day: "2-digit" }, timeZone)
  );
}

