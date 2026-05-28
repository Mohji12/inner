import { useEffect, useState } from "react";
import { formatLiveSessionWindow } from "@/lib/sessionBooking";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";

type Props = {
  durationMinutes: number;
  className?: string;
};

export function LiveSessionWindowPreview({ durationMinutes, className }: Props) {
  const timeZone = useEffectiveTimeZone();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const label = formatLiveSessionWindow(durationMinutes, timeZone, now);

  return (
    <p className={className}>
      <span className="text-muted-foreground">Session time (your local time): </span>
      <span className="font-medium text-foreground">{label}</span>
    </p>
  );
}
