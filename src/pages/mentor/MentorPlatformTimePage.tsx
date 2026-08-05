import { useQuery } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { getMentorPresenceTime } from "@/api/mentors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";

function formatHours(hours: number): string {
  return `${hours.toFixed(2)} h`;
}

function formatMonthLabel(monthStart: string): string {
  const d = new Date(`${monthStart}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function MentorPlatformTimePage() {
  const { t } = useLanguage();
  const p = t.app.mentorPlatformTime;

  const statsQ = useQuery({
    queryKey: ["mentor", "presence-time"],
    queryFn: () => getMentorPresenceTime(12, 6),
    refetchInterval: 60_000,
  });

  const data = statsQ.data;
  const minHours = data?.min_hours ?? 20;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">{p.label}</p>
        <h1 className="font-serif text-3xl tracking-tight">{p.heading}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {p.description.replace("{hours}", String(minHours))}
        </p>
      </div>

      {statsQ.isLoading && !data ? (
        <p className="text-sm text-muted-foreground">{p.loading}</p>
      ) : null}

      {statsQ.isError ? (
        <p className="text-sm text-destructive">
          {(statsQ.error as Error)?.message || p.loadError}
        </p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{p.thisWeek}</CardDescription>
                <CardTitle className="flex items-center gap-2 font-serif text-3xl">
                  <Timer className="h-6 w-6 text-muted-foreground" />
                  {formatHours(data.this_week.hours_online)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {p.weekRange.replace("{start}", data.this_week.week_start)} · {p.target.replace("{hours}", String(minHours))}
                </p>
                {data.this_week.meets_minimum ? (
                  <Badge variant="secondary">{p.met}</Badge>
                ) : (
                  <Badge variant="destructive">{p.below.replace("{hours}", String(minHours))}</Badge>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{p.thisMonth}</CardDescription>
                <CardTitle className="flex items-center gap-2 font-serif text-3xl">
                  <Timer className="h-6 w-6 text-muted-foreground" />
                  {formatHours(data.this_month.hours_online)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>{formatMonthLabel(data.this_month.month_start)}</p>
                <p className="mt-1">{p.timezoneHint.replace("{tz}", data.timezone)}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{p.weeklyHistory}</CardTitle>
                <CardDescription>{p.weeklyHistoryHint}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{p.colWeek}</TableHead>
                      <TableHead>{p.colHours}</TableHead>
                      <TableHead>{p.colTarget}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.weeks.map((w) => (
                      <TableRow key={w.week_start}>
                        <TableCell className="font-mono text-xs">{w.week_start}</TableCell>
                        <TableCell>{formatHours(w.hours_online)}</TableCell>
                        <TableCell>
                          {w.meets_minimum ? (
                            <Badge variant="secondary">{p.met}</Badge>
                          ) : (
                            <Badge variant="destructive">{p.below.replace("{hours}", String(minHours))}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{p.monthlyHistory}</CardTitle>
                <CardDescription>{p.monthlyHistoryHint}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{p.colMonth}</TableHead>
                      <TableHead>{p.colHours}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.months.map((m) => (
                      <TableRow key={m.month_start}>
                        <TableCell>{formatMonthLabel(m.month_start)}</TableCell>
                        <TableCell>{formatHours(m.hours_online)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
