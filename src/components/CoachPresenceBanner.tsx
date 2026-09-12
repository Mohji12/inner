import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMentorPresenceStatus, patchMentorPresenceMode, type MentorPresenceMode } from "@/api/mentors";
import { PresenceIndicator, type PresenceStatus } from "@/components/PresenceIndicator";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { mentorPresenceHint, mentorPresenceLabel } from "@/lib/coachPresenceStatus";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MODE_BUTTONS: MentorPresenceMode[] = ["online", "offline", "paused", "occupied"];

/** Full-width banner so coaches clearly see and control their status after login. */
export function CoachPresenceBanner({ className }: { className?: string }) {
  const { t } = useLanguage();
  const d = t.app.dashboardMentor;
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["mentor", "presence-status"],
    queryFn: getMentorPresenceStatus,
    refetchInterval: 10_000,
  });

  const modeMut = useMutation({
    mutationFn: (mode: MentorPresenceMode) => patchMentorPresenceMode(mode),
    onSuccess: (next) => {
      queryClient.setQueryData(["mentor", "presence-status"], next);
      void queryClient.invalidateQueries({ queryKey: ["mentors"] });
      void queryClient.invalidateQueries({ queryKey: ["mentor"] });
      if (next.presence_mode === "online") toast.success(d.presenceToastOnline);
      else if (next.presence_mode === "offline") toast.message(d.presenceToastOffline);
      else if (next.presence_mode === "paused") toast.message(d.presenceToastPaused);
      else toast.message(d.presenceToastOccupied);
    },
    onError: () => {
      toast.error(d.presenceToggleFailed);
    },
  });

  const status = (data?.status ?? "offline") as PresenceStatus;
  const selectedMode = (data?.presence_mode ?? "offline") as MentorPresenceMode;
  const title = mentorPresenceLabel(status, d);
  const hint = mentorPresenceHint(status, d);
  const busy = Boolean(data?.chat_busy);

  const modeLabel = (mode: MentorPresenceMode) => {
    if (mode === "online") return d.presenceModeOnline;
    if (mode === "offline") return d.presenceModeOffline;
    if (mode === "paused") return d.presenceModePaused;
    return d.presenceModeOccupied;
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3",
        status === "online" && "border-emerald-500/35 bg-emerald-500/10",
        status === "busy" && "border-amber-500/35 bg-amber-500/10",
        status === "paused" && "border-violet-500/35 bg-violet-500/10",
        status === "occupied" && "border-orange-500/35 bg-orange-500/10",
        status === "unavailable" && "border-sky-500/35 bg-sky-500/10",
        status === "offline" && "border-border/60 bg-muted/30",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-3">
        <PresenceIndicator status={status} className="mt-0.5" />
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold",
              status === "online" && "text-emerald-800 dark:text-emerald-300",
              status === "busy" && "text-amber-900 dark:text-amber-300",
              status === "paused" && "text-violet-900 dark:text-violet-300",
              status === "occupied" && "text-orange-900 dark:text-orange-300",
              status === "unavailable" && "text-sky-900 dark:text-sky-300",
              status === "offline" && "text-foreground",
            )}
          >
            {title}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>

      {busy ? (
        <p className="text-xs text-muted-foreground">{d.presenceToggleDisabledBusy}</p>
      ) : (
        <div
          className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          role="group"
          aria-label={d.presenceModeGroupLabel}
        >
          {MODE_BUTTONS.map((mode) => {
            const active = selectedMode === mode && status !== "busy";
            return (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                disabled={modeMut.isPending}
                aria-pressed={active}
                className={cn(
                  "min-w-[7.5rem] justify-center",
                  active && mode === "online" && "bg-emerald-700 hover:bg-emerald-700/90",
                  active && mode === "offline" && "bg-slate-700 hover:bg-slate-700/90",
                  active && mode === "paused" && "bg-violet-700 hover:bg-violet-700/90",
                  active && mode === "occupied" && "bg-orange-700 hover:bg-orange-700/90",
                )}
                onClick={() => {
                  if (selectedMode === mode) return;
                  modeMut.mutate(mode);
                }}
              >
                {modeLabel(mode)}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
