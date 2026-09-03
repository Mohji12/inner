import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  showDate?: boolean;
};

export function LiveClock({ className, showDate = false }: Props) {
  const timeZone = useEffectiveTimeZone();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = formatTimeLocal(now, { second: "2-digit" }, timeZone);
  const date = showDate
    ? formatDateLocal(now, { weekday: "short", month: "short", day: "numeric" }, timeZone)
    : null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-center",
        className,
      )}
      title="Current local time"
    >
      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="leading-tight">
        {date ? <p className="text-[10px] text-muted-foreground">{date}</p> : null}
        <p className="font-mono text-sm tabular-nums">{time}</p>
      </div>
    </div>
  );
}
