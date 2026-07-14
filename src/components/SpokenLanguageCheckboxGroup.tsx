import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { SPOKEN_LANGUAGE_OPTIONS, spokenLanguageLabel } from "@/lib/spokenLanguageOptions";

type SpokenLanguageCheckboxGroupProps = {
  id?: string;
  value: string[];
  onChange: (languages: string[]) => void;
  className?: string;
};

export default function SpokenLanguageCheckboxGroup({
  id = "spoken-languages",
  value,
  onChange,
  className,
}: SpokenLanguageCheckboxGroupProps) {
  const { language, htmlLang } = useLanguage();

  const toggle = (lang: string, checked: boolean) => {
    if (checked) {
      onChange(value.includes(lang) ? value : [...value, lang]);
      return;
    }
    onChange(value.filter((item) => item !== lang));
  };

  return (
    <div
      id={id}
      lang={htmlLang}
      className={cn(
        "max-h-48 overflow-y-auto rounded-md border border-input bg-background p-3",
        className,
      )}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SPOKEN_LANGUAGE_OPTIONS.map((lang) => {
          const checked = value.includes(lang);
          const inputId = `${id}-${lang.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <label
              key={lang}
              htmlFor={inputId}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50"
            >
              <Checkbox
                id={inputId}
                checked={checked}
                onCheckedChange={(state) => toggle(lang, state === true)}
              />
              <span>{spokenLanguageLabel(lang, language)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
