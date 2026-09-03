/** Human-readable name for dashboard greetings and chrome. */
export function personDisplayName(fullName: string | null | undefined, fallback: string): string {
  const name = (fullName || "").trim();
  return name || fallback;
}
