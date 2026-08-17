import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarOff, Clock, Trash2 } from "lucide-react";
import {
  createMyAvailabilityWindow,
  createMyUnavailability,
  deleteMyAvailabilityWindow,
  deleteMyUnavailability,
  getMentorMe,
  listMyAvailabilityWindows,
  listMyUnavailability,
} from "@/api/mentors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { formatCoachUnavailabilityRow } from "@/lib/mentorUnavailability";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { useLanguage } from "@/i18n/LanguageContext";
import { humanizeApiError } from "@/lib/humanizeApiError";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MentorAvailabilityPage = () => {
  const { t } = useLanguage();
  const a = t.app.mentorAvailability;
  const u = t.app.mentorUnavailability;
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

  const unavailabilityQuery = useQuery({
    queryKey: ["mentor", "me", "unavailability"],
    queryFn: listMyUnavailability,
  });

  const coachTz = profileQuery.data?.timezone || effectiveTimeZone || "UTC";

  const [windowDate, setWindowDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");

  const [offKind, setOffKind] = useState<"one_off" | "weekly">("one_off");
  const [offDate, setOffDate] = useState("");
  const [offWeekday, setOffWeekday] = useState("0");
  const [offAllDay, setOffAllDay] = useState(false);
  const [offStartTime, setOffStartTime] = useState("09:00");
  const [offEndTime, setOffEndTime] = useState("12:00");

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

  const createOffMut = useMutation({
    mutationFn: () => {
      const start = offAllDay ? null : offStartTime.length === 5 ? `${offStartTime}:00` : offStartTime;
      const end = offAllDay ? null : offEndTime.length === 5 ? `${offEndTime}:00` : offEndTime;
      return createMyUnavailability({
        kind: offKind,
        all_day: offAllDay,
        date: offKind === "one_off" ? offDate : null,
        weekday: offKind === "weekly" ? Number(offWeekday) : null,
        start_time: start,
        end_time: end,
        timezone: coachTz,
      });
    },
    onSuccess: () => {
      toast.success(u.added);
      setOffDate("");
      void queryClient.invalidateQueries({ queryKey: ["mentor", "me", "unavailability"] });
    },
    onError: (err) => toast.error(humanizeApiError(err)),
  });

  const deleteOffMut = useMutation({
    mutationFn: (id: string) => deleteMyUnavailability(id),
    onSuccess: () => {
      toast.success(u.removed);
      void queryClient.invalidateQueries({ queryKey: ["mentor", "me", "unavailability"] });
    },
    onError: (err) => toast.error(humanizeApiError(err)),
  });

  const windows = useMemo(() => windowsQuery.data ?? [], [windowsQuery.data]);
  const offRows = useMemo(() => unavailabilityQuery.data ?? [], [unavailabilityQuery.data]);
  const canSubmit = Boolean(windowDate && startTime && endTime) && !createMut.isPending;
  const canSubmitOff =
    (offKind === "one_off" ? Boolean(offDate) : offWeekday !== "") &&
    (offAllDay || Boolean(offStartTime && offEndTime)) &&
    !createOffMut.isPending;

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

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">{u.sectionTitle}</CardTitle>
          <CardDescription>{u.sectionHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={offKind === "one_off" ? "default" : "outline"}
              onClick={() => setOffKind("one_off")}
            >
              {u.kindOneOff}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={offKind === "weekly" ? "default" : "outline"}
              onClick={() => setOffKind("weekly")}
            >
              {u.kindWeekly}
            </Button>
          </div>

          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmitOff) return;
              createOffMut.mutate();
            }}
          >
            {offKind === "one_off" ? (
              <div className="space-y-2">
                <Label htmlFor="unavail-date">{u.date}</Label>
                <Input
                  id="unavail-date"
                  type="date"
                  value={offDate}
                  onChange={(e) => setOffDate(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="unavail-weekday">{u.weekday}</Label>
                <Select value={offWeekday} onValueChange={setOffWeekday}>
                  <SelectTrigger id="unavail-weekday">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {u.weekdays.map((label, index) => (
                      <SelectItem key={label} value={String(index)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id="unavail-all-day"
                  checked={offAllDay}
                  onCheckedChange={(checked) => setOffAllDay(checked === true)}
                />
                <Label htmlFor="unavail-all-day" className="cursor-pointer font-normal">
                  {u.allDay}
                </Label>
              </div>
            </div>
            {!offAllDay ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="unavail-start">{u.startTime}</Label>
                  <Input
                    id="unavail-start"
                    type="time"
                    value={offStartTime}
                    onChange={(e) => setOffStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unavail-end">{u.endTime}</Label>
                  <Input
                    id="unavail-end"
                    type="time"
                    value={offEndTime}
                    onChange={(e) => setOffEndTime(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : null}
            <div className={cn("flex items-end", offAllDay && "sm:col-span-2 lg:col-span-2")}>
              <Button type="submit" className="w-full" disabled={!canSubmitOff}>
                {createOffMut.isPending ? u.saving : u.add}
              </Button>
            </div>
          </form>
          <p className="text-xs text-muted-foreground">
            {u.timezoneHint}: <span className="font-medium text-foreground">{coachTz}</span>
          </p>

          <div className="space-y-3 border-t border-border/60 pt-4">
            <div>
              <p className="font-medium">{u.listTitle}</p>
              <p className="text-sm text-muted-foreground">{u.listHint}</p>
            </div>
            {unavailabilityQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{u.loading}</p>
            ) : offRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{u.empty}</p>
            ) : (
              offRows.map((row) => {
                const display = formatCoachUnavailabilityRow(row, u, effectiveTimeZone);
                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <CalendarOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{display.title}</p>
                        {display.subtitle ? (
                          <p className="text-sm text-muted-foreground">{display.subtitle}</p>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={deleteOffMut.isPending}
                      onClick={() => deleteOffMut.mutate(row.id)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      {u.remove}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MentorAvailabilityPage;
