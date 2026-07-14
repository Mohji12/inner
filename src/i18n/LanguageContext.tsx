import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { type Language, type Translations, translations, rtlLanguages, languageHtmlLang } from "./translations";
import { appEn, type AppCopy } from "./appBase";
import { appOverrides } from "./appOverrides";
import { mergeDeep } from "./mergeDeep";

export type FullTranslations = Translations & { app: AppCopy };

interface LanguageContextType {
  language: Language;
  /** BCP-47 locale for `lang` attributes (e.g. fr-FR). */
  htmlLang: string;
  setLanguage: (lang: Language) => void;
  t: FullTranslations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("lang") as Language | null;
    return saved && saved in translations ? saved : "en";
  });

  const htmlLang = languageHtmlLang[language] ?? language;

  useEffect(() => {
    localStorage.setItem("lang", language);
    document.documentElement.dir = rtlLanguages.includes(language) ? "rtl" : "ltr";
    document.documentElement.lang = htmlLang;
  }, [language, htmlLang]);

  const t = useMemo((): FullTranslations => {
    try {
      return {
        ...(translations[language] as Translations),
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
