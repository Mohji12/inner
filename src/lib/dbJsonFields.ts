/**
 * Helpers for MySQL JSON columns mirrored in FastAPI (list fields on users / mentors / bookings).
 */

export function unknownListToStrings(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return value.map((x) => (typeof x === "string" ? x : String(x))).filter(Boolean);
}

/** Parse comma- or semicolon-separated lines into a string list for JSON arrays. */
export function commaSeparatedToStringList(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function stringListToCommaSeparated(arr: string[] | null | undefined): string {
  if (!arr?.length) return "";
  return arr.join(", ");
}
