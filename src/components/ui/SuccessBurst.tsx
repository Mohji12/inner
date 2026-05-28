import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: { ring: "h-12 w-12", icon: "h-6 w-6" },
  md: { ring: "h-16 w-16", icon: "h-8 w-8" },
  lg: { ring: "h-20 w-20", icon: "h-10 w-10" },
} as const;

const SPARKS = [
  { tx: "20px", ty: "-24px", delay: "0ms" },
  { tx: "-22px", ty: "-16px", delay: "50ms" },
  { tx: "24px", ty: "12px", delay: "80ms" },
  { tx: "-18px", ty: "20px", delay: "30ms" },
  { tx: "0px", ty: "-28px", delay: "60ms" },
  { tx: "16px", ty: "22px", delay: "100ms" },
];

type Props = {
  size?: keyof typeof SIZE;
  label?: string;
  description?: string;
  className?: string;
};

export function SuccessBurst({ size = "md", label, description, className }: Props) {
  const s = SIZE[size];

  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <div className="relative flex items-center justify-center">
        {SPARKS.map((spark, i) => (
          <span
            key={i}
            className="success-spark pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold"
            style={
              {
                "--tx": spark.tx,
                "--ty": spark.ty,
                animationDelay: spark.delay,
              } as React.CSSProperties
            }
          />
        ))}
        <div
          className={cn(
            "success-pop flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25",
            s.ring,
          )}
        >
          <Check className={cn(s.icon, "success-check")} strokeWidth={2.5} aria-hidden />
        </div>
      </div>
      {label ? <p className="success-fade-up font-serif text-xl font-medium text-foreground">{label}</p> : null}
      {description ? (
        <p className="success-fade-up success-fade-up-delay text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function AuthSuccessOverlay({ message, description }: { message: string; description?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-[2px]">
      <SuccessBurst size="lg" label={message} description={description} />
    </div>
  );
}
