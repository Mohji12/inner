import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMentorPresenceStatus } from "@/api/mentors";
import { getUserPresenceStatus } from "@/api/users";
import { useAuth } from "@/auth/AuthContext";
import { PresenceIndicator, type PresenceStatus } from "@/components/PresenceIndicator";
import { useLanguage } from "@/i18n/LanguageContext";
import { mentorPresenceHint, mentorPresenceLabel, mentorPresenceVisibleToUsers } from "@/lib/coachPresenceStatus";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TOAST_KEY = "coach_online_toast_shown";

/** Compact presence chip for dashboard headers (coach gets clear “you are online” copy). */
export function OnlineStatusBadge() {
  const { role } = useAuth();
  const { t } = useLanguage();
  const d = t.app.dashboardMentor;
  const toastedRef = useRef(false);

  const mentorQuery = useQuery({
    queryKey: ["mentor", "presence-status"],
    queryFn: getMentorPresenceStatus,
    enabled: role === "mentor",
    refetchInterval: 10_000,
  });

  const userQuery = useQuery({
    queryKey: ["user", "presence-status"],
    queryFn: getUserPresenceStatus,
    enabled: role === "user",
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (role !== "mentor" || !mentorQuery.data) return;
    if (!mentorPresenceVisibleToUsers(mentorQuery.data.status)) return;
    if (toastedRef.current) return;
    if (sessionStorage.getItem(TOAST_KEY) === "1") {
      toastedRef.current = true;
      return;
    }
    toastedRef.current = true;
    sessionStorage.setItem(TOAST_KEY, "1");
    toast.success(d.presenceToastOnline, { duration: 5000 });
  }, [role, mentorQuery.data, d.presenceToastOnline]);

  if (role === "mentor") {
    if (mentorQuery.isLoading && !mentorQuery.data) {
      return (
        <div
          className="inline-flex min-w-0 max-w-[9.5rem] items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-2 py-1 sm:max-w-[16rem] sm:px-3 sm:py-1.5"
          title={d.presenceOfflineHint}
          role="status"
        >
          <PresenceIndicator status="offline" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold text-muted-foreground">{d.presenceConnecting}</p>
          </div>
        </div>
      );
    }
    const status = (mentorQuery.data?.status ?? "offline") as PresenceStatus;
    const label = mentorPresenceLabel(status, d);
    const hint = mentorPresenceHint(status, d);

    return (
      <div
        className={cn(
          "inline-flex min-w-0 max-w-[9.5rem] shrink-0 items-center gap-2 rounded-full border px-2 py-1 sm:max-w-[16rem] sm:px-3 sm:py-1.5",
          status === "online" && "border-emerald-500/40 bg-emerald-500/10",
          status === "busy" && "border-amber-500/40 bg-amber-500/10",
          status === "occupied" && "border-orange-500/40 bg-orange-500/10",
          status === "unavailable" && "border-sky-500/40 bg-sky-500/10",
          status === "offline" && "border-border/60 bg-muted/40",
          status === "paused" && "border-violet-500/40 bg-violet-500/10",
        )}
        title={hint}
        role="status"
        aria-live="polite"
      >
        <PresenceIndicator status={status} />
        <div className="min-w-0 leading-tight">
          <p
            className={cn(
              "truncate text-xs font-semibold",
              status === "online" && "text-emerald-700 dark:text-emerald-400",
              status === "busy" && "text-amber-800 dark:text-amber-400",
              status === "occupied" && "text-orange-800 dark:text-orange-400",
              status === "paused" && "text-violet-800 dark:text-violet-400",
              status === "unavailable" && "text-sky-800 dark:text-sky-400",
              status === "offline" && "text-muted-foreground",
            )}
          >
            {label}
          </p>
          <p className="hidden truncate text-[10px] text-muted-foreground sm:block">{hint}</p>
        </div>
      </div>
    );
  }

  if (role === "user" && userQuery.data) {
    const status: PresenceStatus = userQuery.data.is_online ? "online" : "offline";
    return <PresenceIndicator status={status} showLabel />;
  }

  return null;
}
