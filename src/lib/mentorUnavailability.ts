import type { UnavailabilityOut, UnavailabilityPublicBlock } from "@/api/types";
import type { AppCopy } from "@/i18n/appBase";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";

type UnavailabilityCopy = AppCopy["mentorUnavailability"];

function weekdayLabel(weekday: number | null | undefined, names: readonly string[]): string {
  if (weekday == null || weekday < 0 || weekday > 6) return "";
  return names[weekday] ?? "";
}

function hhmm(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function compactDate(input: string, timeZone?: string | null): string {
  return formatDateLocal(input, { day: "numeric", month: "short" }, timeZone);
}

function untilWhen(block: UnavailabilityPublicBlock, timeZone?: string | null): string {
  if (!block.end_at) return "";
  const datePart = compactDate(block.end_at, timeZone);
  if (block.all_day) return datePart;
  return `${datePart}, ${formatTimeLocal(block.end_at, undefined, timeZone)}`;
}

/** Card-sized current or next time-off line in the viewer timezone. */
export function formatUnavailabilityLine(
  block: UnavailabilityPublicBlock | null | undefined,
  copy: UnavailabilityCopy,
  opts: { unavailableNow?: boolean; timeZone?: string | null } = {},
): string {
  if (!block) return "";
  const tz = opts.timeZone;
  if (opts.unavailableNow && block.end_at) {
    const when = untilWhen(block, tz);
    return when ? copy.until.replace("{when}", when) : copy.badge;
  }
  if (block.kind === "weekly") {
    const day = weekdayLabel(block.weekday, copy.weekdays);
    const days = weekdayLabel(block.weekday, copy.weekdaysPlural) || day;
    if (block.all_day) {
      return day ? copy.everyDay.replace("{day}", day) : copy.badge;
    }
    const start = block.start_at ? formatTimeLocal(block.start_at, undefined, tz) : hhmm(block.start_time);
    const end = block.end_at ? formatTimeLocal(block.end_at, undefined, tz) : hhmm(block.end_time);
    if (!days || !start || !end) return day ? copy.everyDay.replace("{day}", day) : copy.badge;
    return copy.everyDayTimes.replace("{day}", days).replace("{start}", start).replace("{end}", end);
  }
  if (!block.start_at) return copy.badge;
  const datePart = compactDate(block.start_at, tz);
  if (block.all_day) return datePart;
  const start = formatTimeLocal(block.start_at, undefined, tz);
  const end = block.end_at ? formatTimeLocal(block.end_at, undefined, tz) : "";
  if (!end) return `${datePart}, ${start}`;
  return copy.offDateTimes.replace("{date}", datePart).replace("{start}", start).replace("{end}", end);
}

export function formatCoachUnavailabilityRow(
  row: UnavailabilityOut,
  copy: UnavailabilityCopy,
  timeZone?: string | null,
): { title: string; subtitle: string } {
  if (row.kind === "weekly") {
    const day = weekdayLabel(row.weekday, copy.weekdays);
    const days = weekdayLabel(row.weekday, copy.weekdaysPlural) || day;
    if (row.all_day) {
      return { title: copy.everyDay.replace("{day}", day), subtitle: copy.allDay };
    }
    return {
      title: copy.everyDayTimes
        .replace("{day}", days)
        .replace("{start}", hhmm(row.start_time))
        .replace("{end}", hhmm(row.end_time)),
      subtitle: row.timezone,
    };
  }
  if (!row.start_at_utc || !row.end_at_utc) {
    return { title: copy.badge, subtitle: "" };
  }
  const datePart = formatDateLocal(
    row.start_at_utc,
    { weekday: "short", month: "short", day: "numeric", year: "numeric" },
    timeZone,
  );
  if (row.all_day) {
    return { title: datePart, subtitle: copy.allDay };
  }
  return {
    title: datePart,
    subtitle: `${formatTimeLocal(row.start_at_utc, undefined, timeZone)} – ${formatTimeLocal(row.end_at_utc, undefined, timeZone)}`,
  };
}
