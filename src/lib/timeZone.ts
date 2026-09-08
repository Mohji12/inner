export function resolveBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function safeTimeZone(timeZone?: string | null): string {
  return timeZone?.trim() || resolveBrowserTimeZone();
}

/**
 * Parse API datetimes that are stored/sent as UTC.
 * FastAPI/Pydantic often emit naive ISO strings (`2026-09-08T08:57:45`) without `Z`.
 * Browsers treat those as *local* time, which shifts display for non-UTC zones (e.g. IST).
 */
export function parseApiUtcDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);

  const raw = String(input).trim();
  if (!raw) return new Date(NaN);

  // Date-only → UTC midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00.000Z`);
  }

  // Already has an explicit offset or Z
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return new Date(raw);
  }

  // Naive ISO datetime from API → treat as UTC
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) {
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    return new Date(`${normalized}Z`);
  }

  return new Date(raw);
}

export function formatDateLocal(
  input: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
  timeZone?: string | null,
): string {
  const date = parseApiUtcDate(input);
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
  const date = parseApiUtcDate(input);
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
  const d = parseApiUtcDate(utcIso);
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
