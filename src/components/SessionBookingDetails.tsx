import type { SessionBookingMeta } from "@/api/types";
import { formatSessionBookingSummary } from "@/lib/sessionBooking";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  booking: SessionBookingMeta;
  variant?: "banner" | "compact" | "inline";
  className?: string;
};

export function SessionBookingDetails({ booking, variant = "banner", className }: Props) {
  const timeZone = useEffectiveTimeZone();
  const { primary, secondary } = formatSessionBookingSummary(booking, timeZone);

  if (variant === "inline") {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        <span className="font-medium text-foreground">{primary}</span>
        <span className="mx-1">·</span>
        {secondary}
      </p>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("space-y-0.5", className)}>
        <p className="text-xs font-medium text-foreground">{primary}</p>
        <p className="text-[10px] text-muted-foreground">{secondary}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm",
        className,
      )}
    >
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium leading-snug">{primary}</p>
        <p className="text-xs text-muted-foreground">{secondary}</p>
      </div>
    </div>
  );
}
