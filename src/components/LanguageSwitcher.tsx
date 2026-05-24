import { useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { languageLabels, type Language } from "@/i18n/translations";
import LanguageFlag from "@/components/LanguageFlag";
import { cn } from "@/lib/utils";

type Props = {
  /** When true, use compact styling for dense headers */
  compact?: boolean;
};

export function LanguageSwitcher({ compact }: Props) {
  const [open, setOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const langs = Object.entries(languageLabels) as [Language, string][];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/60",
          compact && "px-1.5 py-1 text-xs",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe className="h-4 w-4 shrink-0 opacity-70" />
        <LanguageFlag language={language} className="h-4 w-6" />
        <span className="font-medium">{language.toUpperCase()}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 mt-2 min-w-[200px] animate-in rounded-xl border border-border bg-popover py-2 text-popover-foreground shadow-lg fade-in slide-in-from-top-2"
            role="listbox"
          >
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t.app.shell.language}
            </p>
            {langs.map(([code, label]) => (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={language === code}
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/10",
                  language === code && "bg-accent/15 font-semibold",
                )}
              >
                <LanguageFlag language={code} className="h-5 w-[1.875rem]" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
