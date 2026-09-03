import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  password: string;
}

const PasswordStrengthMeter = ({ password }: PasswordStrengthMeterProps) => {
  const { t } = useLanguage();
  const copy = t.app.passwordStrength;

  const getStrength = (pwd: string) => {
    let score = 0;
    if (!pwd) return score;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score += 1;
    return score;
  };

  const score = getStrength(password);
  const percentage = (score / 5) * 100;

  const getLabel = (s: number) => {
    if (s === 0) return "";
    if (s <= 2) return copy.weak;
    if (s <= 4) return copy.fair;
    return copy.strong;
  };

  const getColorClass = (s: number) => {
    if (s <= 2) return "bg-destructive";
    if (s <= 4) return "bg-orange-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{copy.title}</span>
                        <span
          className={cn(
            "font-medium",
            score <= 2 ? "text-destructive" : score <= 4 ? "text-amber-800" : "text-emerald-900",
          )}
        >
          {getLabel(score)}
        </span>
      </div>
      <Progress value={percentage} className="h-1" indicatorClassName={getColorClass(score)} />
      <ul className="grid list-inside list-disc grid-cols-2 gap-x-2 text-[10px] text-muted-foreground">
        <li className={password.length >= 8 ? "font-medium text-emerald-900" : "text-foreground/55"}>
          {copy.minChars}
        </li>
        <li className={/[A-Z]/.test(password) ? "font-medium text-emerald-900" : "text-foreground/55"}>
          {copy.uppercase}
        </li>
        <li className={/[a-z]/.test(password) ? "font-medium text-emerald-900" : "text-foreground/55"}>
          {copy.lowercase}
        </li>
        <li className={/[0-9]/.test(password) ? "font-medium text-emerald-900" : "text-foreground/55"}>
          {copy.digit}
        </li>
        <li className={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? "font-medium text-emerald-900" : "text-foreground/55"}>
          {copy.special}
        </li>
      </ul>
    </div>
  );
};

export default PasswordStrengthMeter;
