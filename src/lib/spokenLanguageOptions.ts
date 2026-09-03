import type { Language } from "@/i18n/translations";

/** Values stored in `mentor.languages_spoken` JSON (stable English names). */
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

/** BCP-47 codes used only for localizing display labels via Intl.DisplayNames. */
const SPOKEN_LANGUAGE_CODES: Record<string, string> = {
  English: "en",
  Dutch: "nl",
  French: "fr",
  German: "de",
  Spanish: "es",
  Italian: "it",
  Portuguese: "pt",
  Arabic: "ar",
  "Mandarin Chinese": "zh",
  Japanese: "ja",
  Korean: "ko",
  Hindi: "hi",
  Russian: "ru",
  Polish: "pl",
  Turkish: "tr",
  Swedish: "sv",
  Norwegian: "no",
  Danish: "da",
  Finnish: "fi",
  Greek: "el",
  Hebrew: "he",
  Czech: "cs",
  Romanian: "ro",
  Hungarian: "hu",
  Ukrainian: "uk",
  Indonesian: "id",
};

export function spokenLanguageLabel(storedName: string, uiLanguage: Language | string): string {
  const code = SPOKEN_LANGUAGE_CODES[storedName];
  if (!code) return storedName;
  try {
    return new Intl.DisplayNames([uiLanguage], { type: "language" }).of(code) ?? storedName;
  } catch {
    return storedName;
  }
}

export function normalizeSpokenLanguagesFromApi(raw: string[]): string[] {
  const allowed = new Set(SPOKEN_LANGUAGE_OPTIONS);
  return raw.filter((s) => allowed.has(s));
}
