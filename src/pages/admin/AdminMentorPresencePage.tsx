import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import {
  fetchAdminMentorPresence,
  fetchAdminMentorPresenceDetail,
  type AdminMentorPresenceRow,
} from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";

/** Monday (UTC date string YYYY-MM-DD) for a given Date, using local calendar Monday. */
function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const d = new Date(`${weekStart}T12:00:00`);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return mondayOf(d);
}

function formatHours(hours: number): string {
  return `${hours.toFixed(2)} h`;
}

export default function AdminMentorPresencePage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const listQuery = useQuery({
    queryKey: ["admin", "mentor-presence", weekStart, search, limit],
    queryFn: () =>
      fetchAdminMentorPresence({
        week_start: weekStart,
        q: search || undefined,
        skip: 0,
        limit,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["admin", "mentor-presence-detail", selectedId],
    queryFn: () => fetchAdminMentorPresenceDetail(selectedId!, 8),
    enabled: Boolean(selectedId),
  });

  const items = listQuery.data?.items ?? [];
  const minHours = listQuery.data?.min_hours ?? 20;
  const selectedRow = useMemo(
    () => items.find((r) => r.mentor_id === selectedId) ?? null,
    [items, selectedId],
  );

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(q.trim());
  };

  const weekEndLabel = useMemo(() => {
    const d0 = new Date(`${weekStart}T12:00:00`);
    d0.setDate(d0.getDate() + 6);
    return d0.toISOString().slice(0, 10);
  }, [weekStart]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-serif text-3xl">{d.mentorPresence}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{d.mentorPresenceDescription}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{d.mentorPresenceFilters}</CardTitle>
          <CardDescription>
            {d.mentorPresenceWeekLabel}: {weekStart} → {weekEndLabel} · {d.mentorPresenceMinHours.replace("{hours}", String(minHours))}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="week-start">
              {d.mentorPresenceWeekStart}
            </label>
            <Input
              id="week-start"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(mondayOf(new Date(`${e.target.value}T12:00:00`)))}
              className="w-44"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart(shiftWeek(weekStart, -1))}>
              {d.mentorPresencePrevWeek}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>
              {d.mentorPresenceThisWeek}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setWeekStart(shiftWeek(weekStart, 1))}>
              {d.mentorPresenceNextWeek}
            </Button>
          </div>
          <form onSubmit={onSearch} className="flex flex-1 flex-wrap gap-2 md:justify-end">
            <Input
              placeholder={d.mentorPresenceSearchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="min-w-[12rem] max-w-sm"
            />
            <Button type="submit" variant="secondary">
              {d.mentorPresenceSearch}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{d.mentorPresenceTableTitle}</CardTitle>
            <CardDescription>
              {listQuery.isLoading
                ? d.tableLoading
                : d.mentorPresenceTotal.replace("{count}", String(listQuery.data?.total ?? 0))}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{d.mentorPresenceColName}</TableHead>
                  <TableHead>{d.mentorPresenceColEmail}</TableHead>
                  <TableHead>{d.mentorPresenceColHours}</TableHead>
                  <TableHead>{d.mentorPresenceColTarget}</TableHead>
                  <TableHead>{d.mentorPresenceColWarning}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row: AdminMentorPresenceRow) => (
                  <TableRow
                    key={row.mentor_id}
                    className={`cursor-pointer ${selectedId === row.mentor_id ? "bg-muted/50" : ""}`}
                    onClick={() => setSelectedId(row.mentor_id)}
                  >
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.email}</TableCell>
                    <TableCell>{formatHours(row.hours_online)}</TableCell>
                    <TableCell>
                      {row.meets_minimum ? (
                        <Badge variant="secondary">{d.mentorPresenceMet}</Badge>
                      ) : (
                        <Badge variant="destructive">{d.mentorPresenceBelow}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.warning_sent_at ? new Date(row.warning_sent_at).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {!listQuery.isLoading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {d.mentorPresenceEmpty}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            {(listQuery.data?.total ?? 0) > limit ? (
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setLimit((n) => n + 50)}>
                  {d.loadMore}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{d.mentorPresenceDetailTitle}</CardTitle>
            <CardDescription>
              {selectedRow
                ? `${selectedRow.full_name} · ${selectedRow.email}`
                : d.mentorPresenceDetailHint}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedId ? (
              <p className="text-sm text-muted-foreground">{d.mentorPresenceSelectCoach}</p>
            ) : detailQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">{d.tableLoading}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{d.mentorPresenceColWeek}</TableHead>
                    <TableHead>{d.mentorPresenceColHours}</TableHead>
                    <TableHead>{d.mentorPresenceColTarget}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(detailQuery.data?.weeks ?? []).map((w) => (
                    <TableRow key={w.week_start}>
                      <TableCell className="font-mono text-xs">{w.week_start}</TableCell>
                      <TableCell>{formatHours(w.hours_online)}</TableCell>
                      <TableCell>
                        {w.meets_minimum ? (
                          <Badge variant="secondary">{d.mentorPresenceMet}</Badge>
                        ) : (
                          <Badge variant="destructive">{d.mentorPresenceBelow}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
