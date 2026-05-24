/** Values stored in `mentor.languages_spoken` JSON (human-readable names). */
export const SPOKEN_LANGUAGE_OPTIONS: readonly string[] = [
  "English",
  "Dutch",
  "French",
  "German",
  "Spanish",
  "Italian",
  "Portuguese",
  "Arabic",
  "Mandarin Chinese",
  "Japanese",
  "Korean",
  "Hindi",
  "Russian",
  "Polish",
  "Turkish",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Greek",
  "Hebrew",
  "Czech",
  "Romanian",
  "Hungarian",
  "Ukrainian",
  "Indonesian",
] as const;

export function normalizeSpokenLanguagesFromApi(raw: string[]): string[] {
  const allowed = new Set(SPOKEN_LANGUAGE_OPTIONS);
  return raw.filter((s) => allowed.has(s));
}
