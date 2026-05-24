import { useQuery } from "@tanstack/react-query";
import type { AdminPeriod } from "@/api/admin";
import { fetchAdminAnalytics } from "@/api/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";
import {
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

export default function AdminAnalyticsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [period, setPeriod] = useState<AdminPeriod>("month");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics", period],
    queryFn: () => fetchAdminAnalytics(period),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  const pick = (rows: { date: string; count: number }[], date: string) => rows.find((r) => r.date === date)?.count ?? 0;
  const pickAmt = (rows: { date: string; amount: string }[], date: string) =>
    Number(rows.find((r) => r.date === date)?.amount ?? 0);

  const dates = new Set<string>();
  for (const x of [
    ...data.bookings_by_day,
    ...data.users_by_day,
    ...data.mentors_by_day,
    ...data.reviews_by_day,
    ...data.payments_by_day,
  ]) {
    dates.add(x.date);
  }
  const merged = [...dates]
    .sort()
    .map((date) => ({
      date,
      bookings: pick(data.bookings_by_day, date),
      users: pick(data.users_by_day, date),
      mentors: pick(data.mentors_by_day, date),
      reviews: pick(data.reviews_by_day, date),
      revenue: pickAmt(data.payments_by_day, date),
    }));

  const periodLabel =
    period === "day" ? d.day : period === "week" ? d.week : period === "month" ? d.month : d.year;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">{d.analytics}</p>
          <h1 className="font-serif text-3xl">Trends</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodLabel} · {new Date(data.range_start).toLocaleString()} → {new Date(data.range_end).toLocaleString()}
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as AdminPeriod)}>
          <TabsList>
            <TabsTrigger value="day">{d.day}</TabsTrigger>
            <TabsTrigger value="week">{d.week}</TabsTrigger>
            <TabsTrigger value="month">{d.month}</TabsTrigger>
            <TabsTrigger value="year">{d.year}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

      {merged.length === 0 ? (
        <p className="text-muted-foreground">{d.noData}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/60 glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Activity by day</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={merged}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="bookings" name="Bookings" stroke={strokePrimary} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="users" name="Users" stroke={strokeAccent} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="reviews" name="Reviews" stroke={strokeMuted} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="border-border/60 glass-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Revenue by day (completed payments)</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={merged}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="EUR" stroke={strokePrimary} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
