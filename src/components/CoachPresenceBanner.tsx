import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMentorPresenceStatus, patchMentorManualOccupied } from "@/api/mentors";
import { PresenceIndicator, type PresenceStatus } from "@/components/PresenceIndicator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";
import { mentorPresenceHint, mentorPresenceLabel } from "@/lib/coachPresenceStatus";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Full-width banner so coaches clearly see they are online after login. */
export function CoachPresenceBanner({ className }: { className?: string }) {
  const { t } = useLanguage();
  const d = t.app.dashboardMentor;
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["mentor", "presence-status"],
    queryFn: getMentorPresenceStatus,
    refetchInterval: 10_000,
  });

  const toggleMut = useMutation({
    mutationFn: (occupied: boolean) => patchMentorManualOccupied(occupied),
    onSuccess: (next) => {
      queryClient.setQueryData(["mentor", "presence-status"], next);
      void queryClient.invalidateQueries({ queryKey: ["mentors"] });
      void queryClient.invalidateQueries({ queryKey: ["mentor"] });
    },
    onError: () => {
      toast.error(d.presenceToggleFailed);
    },
  });

  const status = (data?.status ?? "offline") as PresenceStatus;
  const title = mentorPresenceLabel(status, d);
  const hint = mentorPresenceHint(status, d);
  const busy = Boolean(data?.chat_busy);
  const availableForSessions = !busy && !Boolean(data?.manual_occupied);

  const onToggle = (checked: boolean) => {
    if (busy) return;
    toggleMut.mutate(!checked);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
        status === "online" && "border-emerald-500/35 bg-emerald-500/10",
        status === "busy" && "border-amber-500/35 bg-amber-500/10",
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

      {data?.is_online && !busy ? (
        <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
          <Switch
            id="coach-available-switch"
            checked={availableForSessions}
            disabled={toggleMut.isPending || busy}
            onCheckedChange={onToggle}
            aria-label={d.presenceAvailableSwitchLabel}
          />
          <Label htmlFor="coach-available-switch" className="cursor-pointer text-sm font-medium">
            {availableForSessions ? d.presenceAvailableSwitchOn : d.presenceAvailableSwitchOff}
          </Label>
        </div>
      ) : busy ? (
        <p className="text-xs text-muted-foreground sm:max-w-[12rem]">{d.presenceToggleDisabledBusy}</p>
      ) : null}
    </div>
  );
}
