import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { type Language, type Translations, translations, rtlLanguages, languageHtmlLang } from "./translations";
import { appEn, type AppCopy } from "./appBase";
import { appOverrides } from "./appOverrides";
import { mergeDeep } from "./mergeDeep";
import { safeLocalStorage } from "@/lib/safeStorage";

export type FullTranslations = Translations & { app: AppCopy };

interface LanguageContextType {
  language: Language;
  /** BCP-47 locale for `lang` attributes (e.g. fr-FR). */
  htmlLang: string;
  setLanguage: (lang: Language) => void;
  t: FullTranslations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function isLanguage(value: string | null | undefined): value is Language {
  return Boolean(value && value in translations);
}

/** Prefer saved choice, then browser language, then Dutch (product default). */
function detectInitialLanguage(): Language {
  const saved = safeLocalStorage.getItem("lang");
  if (isLanguage(saved)) return saved;

  if (typeof navigator !== "undefined") {
    const candidates = [navigator.language, ...(navigator.languages ?? [])]
      .map((l) => l.toLowerCase().split("-")[0])
      .filter(Boolean);
    for (const code of candidates) {
      if (isLanguage(code)) return code;
    }
  }

  return "nl";
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    if (!isLanguage(lang)) return;
    setLanguageState(lang);
    safeLocalStorage.setItem("lang", lang);
  }, []);

  const htmlLang = languageHtmlLang[language] ?? language;

  useEffect(() => {
    safeLocalStorage.setItem("lang", language);
    document.documentElement.dir = rtlLanguages.includes(language) ? "rtl" : "ltr";
    document.documentElement.lang = htmlLang;
  }, [language, htmlLang]);

  const t = useMemo((): FullTranslations => {
    try {
      const marketing = translations[language] ?? translations.en;
      return {
        ...(marketing as Translations),
        app: mergeDeep(appEn, appOverrides[language]),
      } as FullTranslations;
    } catch (err) {
      console.error("[i18n] Failed to merge locale copy; falling back to English.", err);
      return {
        ...(translations.en as Translations),
        app: appEn,
      } as FullTranslations;
    }
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, htmlLang, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
