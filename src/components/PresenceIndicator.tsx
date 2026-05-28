import { cn } from "@/lib/utils";

export type PresenceStatus = "online" | "offline" | "busy";

type Props = {
  status: PresenceStatus;
  showLabel?: boolean;
  className?: string;
};

const LABELS: Record<PresenceStatus, string> = {
  online: "Online",
  offline: "Offline",
  busy: "In session",
};

const DOT: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-muted-foreground/40",
  busy: "bg-amber-500",
};

export function PresenceIndicator({ status, showLabel = false, className }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background", DOT[status], status === "online" && "animate-pulse")}
        aria-hidden="true"
      />
      {showLabel ? <span className="text-xs font-medium text-muted-foreground">{LABELS[status]}</span> : null}
    </span>
  );
}
