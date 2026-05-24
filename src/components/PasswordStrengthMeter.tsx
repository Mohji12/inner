import React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  password: str;
}

const PasswordStrengthMeter = ({ password }: PasswordStrengthMeterProps) => {
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
    if (s <= 2) return "Weak";
    if (s <= 4) return "Fairly Strong";
    return "Strong";
  };

  const getColorClass = (s: number) => {
    if (s <= 2) return "bg-destructive";
    if (s <= 4) return "bg-orange-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Password Strength</span>
        <span className={cn("font-medium", score <= 2 ? "text-destructive" : score <= 4 ? "text-orange-500" : "text-green-500")}>
          {getLabel(score)}
        </span>
      </div>
      <Progress value={percentage} className="h-1" indicatorClassName={getColorClass(score)} />
      <ul className="text-[10px] text-muted-foreground list-disc list-inside grid grid-cols-2 gap-x-2">
         <li className={password.length >= 8 ? "text-green-500" : ""}>At least 8 chars</li>
         <li className={/[A-Z]/.test(password) ? "text-green-500" : ""}>Uppercase letter</li>
         <li className={/[a-z]/.test(password) ? "text-green-500" : ""}>Lowercase letter</li>
         <li className={/[0-9]/.test(password) ? "text-green-500" : ""}>At least one digit</li>
         <li className={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? "text-green-500" : ""}>Special character</li>
      </ul>
    </div>
  );
};

export default PasswordStrengthMeter;
