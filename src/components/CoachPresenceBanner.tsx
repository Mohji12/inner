import { useQuery } from "@tanstack/react-query";
import { getMentorPresenceStatus } from "@/api/mentors";
import { PresenceIndicator, type PresenceStatus } from "@/components/PresenceIndicator";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

/** Full-width banner so coaches clearly see they are online after login. */
export function CoachPresenceBanner({ className }: { className?: string }) {
  const { t } = useLanguage();
  const d = t.app.dashboardMentor;

  const { data } = useQuery({
    queryKey: ["mentor", "presence-status"],
    queryFn: getMentorPresenceStatus,
    refetchInterval: 10_000,
  });

  const status = (data?.status ?? "offline") as PresenceStatus;
  const title =
    status === "online"
      ? d.presenceOnline
      : status === "busy"
        ? d.presenceBusy
        : d.presenceOffline;
  const hint =
    status === "online"
      ? d.presenceOnlineHint
      : status === "busy"
        ? d.presenceBusyHint
        : d.presenceOfflineHint;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        status === "online" && "border-emerald-500/35 bg-emerald-500/10",
        status === "busy" && "border-amber-500/35 bg-amber-500/10",
        status === "offline" && "border-border/60 bg-muted/30",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <PresenceIndicator status={status} className="mt-0.5" />
      <div className="min-w-0">
        <p
          className={cn(
            "font-semibold",
            status === "online" && "text-emerald-800 dark:text-emerald-300",
            status === "busy" && "text-amber-900 dark:text-amber-300",
            status === "offline" && "text-foreground",
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
