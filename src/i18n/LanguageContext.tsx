import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { type Language, type Translations, translations, rtlLanguages } from "./translations";
import { appEn, type AppCopy } from "./appBase";
import { appOverrides } from "./appOverrides";
import { mergeDeep } from "./mergeDeep";

export type FullTranslations = Translations & { app: AppCopy };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: FullTranslations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("lang") as Language | null;
    return saved && saved in translations ? saved : "en";
  });

  useEffect(() => {
    localStorage.setItem("lang", language);
    document.documentElement.dir = rtlLanguages.includes(language) ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const t = useMemo(
    () =>
      ({
        ...(translations[language] as Translations),
        app: mergeDeep(appEn, appOverrides[language]),
      }) as FullTranslations,
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
