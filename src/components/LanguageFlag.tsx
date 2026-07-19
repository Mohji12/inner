import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import type { Language } from "@/i18n/translations";
import { languageLabels } from "@/i18n/translations";
import { GB, FR, NL, SA, CN, RU, ES, IT, DE } from "country-flag-icons/react/3x2";

const FLAG_BY_LANGUAGE: Record<Language, ComponentType<SVGProps<SVGSVGElement>>> = {
  en: GB,
  fr: FR,
  nl: NL,
  ar: SA,
  zh: CN,
  ru: RU,
  es: ES,
  it: IT,
  de: DE,
};

type Props = {
  language: Language;
  className?: string;
};

/**
 * Renders the country flag as an SVG (not emoji), so it displays correctly on all platforms.
 */
const LanguageFlag = ({ language, className }: Props) => {
  const Flag = FLAG_BY_LANGUAGE[language];
  const label = languageLabels[language];
  return (
    <Flag
      role="img"
      aria-label={label}
      title={label}
      className={cn("h-4 w-6 shrink-0 rounded-[2px] shadow-sm", className)}
    />
  );
};

export default LanguageFlag;
