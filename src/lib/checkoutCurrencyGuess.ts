/** Best-effort locale → ISO 4217, restricted to `whitelist` (uppercase). Falls back to EUR. */
export function guessCheckoutCurrencyFromLocale(locale: string | undefined, whitelist: string[]): string {
  const wl = whitelist.map((c) => c.toUpperCase());
  const set = new Set(wl);
  if (set.size === 0) return "EUR";
  const regionToCurrency: Record<string, string> = {
    US: "USD",
    GB: "GBP",
    JP: "JPY",
    CH: "CHF",
    AU: "AUD",
    CA: "CAD",
    NZ: "NZD",
    SG: "SGD",
    HK: "HKD",
    KR: "KRW",
    SE: "SEK",
    NO: "NOK",
    DK: "DKK",
    PL: "PLN",
    CZ: "CZK",
    HU: "HUF",
    RO: "RON",
  };

  const tags = [locale, typeof navigator !== "undefined" ? navigator.language : undefined];
  for (const tag of tags) {
    if (!tag) continue;
    const parts = tag.split("-");
    const region = parts.length >= 2 ? parts[parts.length - 1]?.toUpperCase() : "";
    if (region && region.length === 2) {
      const mapped = regionToCurrency[region];
      if (mapped && set.has(mapped)) return mapped;
    }
  }

  const lang = locale?.split("-")[0]?.toLowerCase() ?? "";
  const langHints: Record<string, string> = {
    ja: "JPY",
    ko: "KRW",
    en: "USD",
  };
  const fromLang = langHints[lang];
  if (fromLang && set.has(fromLang)) return fromLang;

  return set.has("EUR") ? "EUR" : wl[0]!;
}
