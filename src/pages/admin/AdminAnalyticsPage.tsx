import { useQuery } from "@tanstack/react-query";
import type { AdminPeriod } from "@/api/admin";
import { fetchAdminAnalytics } from "@/api/admin";
import {
  AdminEntityFilters,
  emptyAdminEntityFilters,
  toAdminEntityApiFilters,
} from "@/components/admin/AdminEntityFilters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UrlVisitTable } from "@/components/admin/UrlVisitTable";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const strokePrimary = "hsl(90 8% 48%)";
const strokeAccent = "hsl(90 15% 40%)";
const strokeMuted = "hsl(90 5% 45%)";
const strokeVisits = "hsl(200 45% 42%)";
const strokeChats = "hsl(32 55% 45%)";

export default function AdminAnalyticsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [period, setPeriod] = useState<AdminPeriod>("month");
  const [draft, setDraft] = useState(emptyAdminEntityFilters);
  const [applied, setApplied] = useState(emptyAdminEntityFilters);
  const apiFilters = useMemo(() => toAdminEntityApiFilters(applied), [applied]);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["admin", "analytics", period, apiFilters],
    queryFn: () => fetchAdminAnalytics(period, apiFilters),
  });

  const pick = (rows: { date: string; count: number }[], date: string) =>
    rows.find((r) => r.date === date)?.count ?? 0;
  const pickAmt = (rows: { date: string; amount: string }[], date: string) =>
    Number(rows.find((r) => r.date === date)?.amount ?? 0);

  const merged = useMemo(() => {
    if (!data) return [];
    const dates = new Set<string>();
    for (const x of [
      ...data.bookings_by_day,
      ...data.users_by_day,
      ...data.mentors_by_day,
      ...data.reviews_by_day,
      ...data.payments_by_day,
      ...(data.page_views_by_day ?? []),
      ...(data.chats_by_day ?? []),
    ]) {
      dates.add(x.date);
    }
    return [...dates]
      .sort()
      .map((date) => ({
        date,
        bookings: pick(data.bookings_by_day, date),
        users: pick(data.users_by_day, date),
        mentors: pick(data.mentors_by_day, date),
        reviews: pick(data.reviews_by_day, date),
        revenue: pickAmt(data.payments_by_day, date),
        pageViews: pick(data.page_views_by_day ?? [], date),
        chats: pick(data.chats_by_day ?? [], date),
      }));
  }, [data]);

  const periodLabel =
    period === "day" ? d.day : period === "week" ? d.week : period === "month" ? d.month : d.year;
  const hasCustomDates = Boolean(applied.dateFrom || applied.dateTo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">{d.analytics}</p>
          <h1 className="font-serif text-3xl">{d.trends}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data
              ? `${hasCustomDates ? d.filteredRange : periodLabel} · ${new Date(data.range_start).toLocaleString()} → ${new Date(data.range_end).toLocaleString()}`
              : hasCustomDates
                ? d.filteredRange
                : periodLabel}
            {isFetching ? ` · ${d.tableLoading}` : ""}
          </p>
        </div>
        {!hasCustomDates ? (
          <Tabs value={period} onValueChange={(v) => setPeriod(v as AdminPeriod)}>
            <TabsList>
              <TabsTrigger value="day">{d.day}</TabsTrigger>
              <TabsTrigger value="week">{d.week}</TabsTrigger>
              <TabsTrigger value="month">{d.month}</TabsTrigger>
              <TabsTrigger value="year">{d.year}</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      <AdminEntityFilters
        value={draft}
        onChange={setDraft}
        onApply={() => setApplied({ ...draft })}
        onClear={() => {
          const empty = emptyAdminEntityFilters();
          setDraft(empty);
          setApplied(empty);
        }}
      />

      {isError ? (
        <p className="text-sm text-destructive">
          {(error as Error)?.message || d.tableLoading}
        </p>
      ) : null}

      {isLoading && !data ? <p className="text-muted-foreground">{d.tableLoading}</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{d.summaryPageViews}</CardDescription>
                <CardTitle className="font-serif text-2xl">{data.summary.page_views ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{d.summaryUniqueVisitors}</CardDescription>
                <CardTitle className="font-serif text-2xl">{data.summary.unique_visitors ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{d.summaryChats}</CardDescription>
                <CardTitle className="font-serif text-2xl">{data.summary.chats ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{d.summaryBookings}</CardDescription>
                <CardTitle className="font-serif text-2xl">{data.summary.bookings}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{d.summaryUsers}</CardDescription>
                <CardTitle className="font-serif text-2xl">{data.summary.new_users}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{d.summaryMentors}</CardDescription>
                <CardTitle className="font-serif text-2xl">{data.summary.new_mentors}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{d.summaryReviews}</CardDescription>
                <CardTitle className="font-serif text-2xl">{data.summary.reviews}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardDescription>{d.summaryRevenue}</CardDescription>
                <CardTitle className="font-serif text-2xl">{data.summary.revenue}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">{d.visitsNote}</p>

          {merged.length === 0 &&
          !(data.top_pages?.length) &&
          !(data.landing_pages?.length) &&
          !(data.referrers?.length) ? (
            <p className="text-muted-foreground">{d.noData}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-border/60 glass-card lg:col-span-2">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">{d.visitsByDay}</CardTitle>
                </CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={merged}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="pageViews" name={d.visitsSeries} stroke={strokeVisits} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="chats" name={d.chatsSeries} stroke={strokeChats} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              {(data.top_pages ?? []).length > 0 ? (
                <Card className="border-border/60 glass-card lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">{d.topPages}</CardTitle>
                    <CardDescription>{d.urlClicksHint}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={data.top_pages}
                          layout="vertical"
                          margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="path" width={160} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="views" name={d.topPagesViews} fill={strokeVisits} radius={[0, 4, 4, 0]} />
                          <Bar dataKey="unique_visitors" name={d.topPagesVisitors} fill={strokeAccent} radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <UrlVisitTable
                      rows={(data.top_pages ?? []).map((row) => ({
                        label: row.path,
                        views: row.views,
                        unique_visitors: row.unique_visitors,
                      }))}
                      urlLabel={d.urlColumn}
                      viewsLabel={d.topPagesViews}
                      visitorsLabel={d.topPagesVisitors}
                      emptyLabel={d.noData}
                    />
                  </CardContent>
                </Card>
              ) : null}
              {(data.landing_pages ?? []).length > 0 ? (
                <Card className="border-border/60 glass-card lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">{d.landingPages}</CardTitle>
                    <CardDescription>{d.landingPagesHint}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UrlVisitTable
                      rows={(data.landing_pages ?? []).map((row) => ({
                        label: row.path,
                        views: row.views,
                        unique_visitors: row.unique_visitors,
                      }))}
                      urlLabel={d.urlColumn}
                      viewsLabel={d.topPagesViews}
                      visitorsLabel={d.topPagesVisitors}
                      emptyLabel={d.noData}
                    />
                  </CardContent>
                </Card>
              ) : null}
              {(data.referrers ?? []).length > 0 ? (
                <Card className="border-border/60 glass-card lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">{d.referrersTitle}</CardTitle>
                    <CardDescription>{d.referrersHint}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UrlVisitTable
                      rows={(data.referrers ?? []).map((row) => ({
                        label: row.host,
                        views: row.views,
                        unique_visitors: row.unique_visitors,
                      }))}
                      urlLabel={d.referrerColumn}
                      viewsLabel={d.topPagesViews}
                      visitorsLabel={d.topPagesVisitors}
                      emptyLabel={d.noData}
                    />
                  </CardContent>
                </Card>
              ) : null}
              <Card className="border-border/60 glass-card lg:col-span-2">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">{d.activityByDay}</CardTitle>
                </CardHeader>
                <CardContent className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={merged}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="bookings" name={d.bookingsSeries} stroke={strokePrimary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="users" name={d.usersSeries} stroke={strokeAccent} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="reviews" name={d.reviews} stroke={strokeMuted} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="border-border/60 glass-card lg:col-span-2">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">{d.revenueByDay}</CardTitle>
                </CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={merged}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" name={d.revenueSeries} stroke={strokePrimary} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
