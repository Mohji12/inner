import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import {
  createMyAvailabilityWindow,
  deleteMyAvailabilityWindow,
  getMentorMe,
  listMyAvailabilityWindows,
} from "@/api/mentors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { useLanguage } from "@/i18n/LanguageContext";
import { humanizeApiError } from "@/lib/humanizeApiError";
import { toast } from "sonner";

const MentorAvailabilityPage = () => {
  const { t } = useLanguage();
  const a = t.app.mentorAvailability;
  const queryClient = useQueryClient();
  const effectiveTimeZone = useEffectiveTimeZone();

  const profileQuery = useQuery({
    queryKey: ["mentor", "me"],
    queryFn: getMentorMe,
  });

  const windowsQuery = useQuery({
    queryKey: ["mentor", "me", "availability-windows"],
    queryFn: listMyAvailabilityWindows,
  });

  const coachTz = profileQuery.data?.timezone || effectiveTimeZone || "UTC";

  const [windowDate, setWindowDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");

  const createMut = useMutation({
    mutationFn: () =>
      createMyAvailabilityWindow({
        window_date: windowDate,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        timezone: coachTz,
      }),
    onSuccess: () => {
      toast.success(a.added);
      setWindowDate("");
      void queryClient.invalidateQueries({ queryKey: ["mentor", "me", "availability-windows"] });
    },
    onError: (err) => toast.error(humanizeApiError(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMyAvailabilityWindow(id),
    onSuccess: () => {
      toast.success(a.removed);
      void queryClient.invalidateQueries({ queryKey: ["mentor", "me", "availability-windows"] });
    },
    onError: (err) => toast.error(humanizeApiError(err)),
  });

  const windows = useMemo(() => windowsQuery.data ?? [], [windowsQuery.data]);
  const canSubmit = Boolean(windowDate && startTime && endTime) && !createMut.isPending;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">{a.label}</p>
        <h1 className="font-serif text-3xl tracking-tight">{a.heading}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{a.description}</p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">{a.addTitle}</CardTitle>
          <CardDescription>{a.addHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              createMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="avail-date">{a.date}</Label>
              <Input
                id="avail-date"
                type="date"
                value={windowDate}
                onChange={(e) => setWindowDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avail-start">{a.startTime}</Label>
              <Input
                id="avail-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avail-end">{a.endTime}</Label>
              <Input
                id="avail-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {createMut.isPending ? a.saving : a.add}
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            {a.timezoneHint}: <span className="font-medium text-foreground">{coachTz}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">{a.upcomingTitle}</CardTitle>
          <CardDescription>{a.upcomingHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {windowsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{a.loading}</p>
          ) : windows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{a.empty}</p>
          ) : (
            windows.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {formatDateLocal(w.start_at_utc, { weekday: "short", month: "short", day: "numeric", year: "numeric" }, effectiveTimeZone)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeLocal(w.start_at_utc, undefined, effectiveTimeZone)}
                      {" – "}
                      {formatTimeLocal(w.end_at_utc, undefined, effectiveTimeZone)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={deleteMut.isPending}
                  onClick={() => deleteMut.mutate(w.id)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {a.remove}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MentorAvailabilityPage;
