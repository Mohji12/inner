import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  getMentorEarnings,
  getMentorEarningsSeries,
  listMentorOnboardingPayments,
  listMentorMonthlyInvoices,
  type AnalyticsPeriod,
} from "@/api/mentors";
import { CoachConnectStatusCard } from "@/components/mentor/CoachConnectStatusCard";
import { CoachWalletCard } from "@/components/mentor/CoachWalletCard";
import { useLanguage } from "@/i18n/LanguageContext";

export default function MentorDashboardHomePage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("month");
  const { t } = useLanguage();

  const earningsQ = useQuery({
    queryKey: ["mentor", "earnings"],
    queryFn: getMentorEarnings,
  });

  const seriesQ = useQuery({
    queryKey: ["mentor", "earnings-series", period],
    queryFn: () => getMentorEarningsSeries(period),
  });

  const invoicesQ = useQuery({
    queryKey: ["mentor", "monthly-invoices"],
    queryFn: listMentorMonthlyInvoices,
  });

  const onboardingQ = useQuery({
    queryKey: ["mentor", "onboarding-payments"],
    queryFn: listMentorOnboardingPayments,
  });

  const chartData = useMemo(() => {
    const data = seriesQ.data;
    if (!data) return [];
    const dates = new Set<string>();
    for (const x of [...data.bookings_by_day, ...data.chat_by_day]) dates.add(x.date);
    const pick = (rows: { date: string; amount: string }[], date: string) =>
      Number(rows.find((r) => r.date === date)?.amount ?? 0);
    return [...dates]
      .sort()
      .map((date) => ({
        date,
        bookings: pick(data.bookings_by_day, date),
        chat: pick(data.chat_by_day, date),
        total: pick(data.bookings_by_day, date) + pick(data.chat_by_day, date),
      }));
  }, [seriesQ.data]);

  const recentInvoices = (invoicesQ.data ?? []).slice(0, 3);
  const latestOnboarding = onboardingQ.data?.[0];
  const onboardingDone = latestOnboarding?.status === "paid";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">{t.app.mentorDashboardHome.label}</p>
          <h1 className="font-serif text-3xl">{t.app.mentorDashboardHome.heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.app.mentorDashboardHome.subheading}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CoachWalletCard />
        <CoachConnectStatusCard />
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription>{t.app.mentorDashboardHome.totalEarnings}</CardDescription>
            {earningsQ.isLoading ? (
              <CardTitle className="font-serif text-2xl">{t.app.common.loading}</CardTitle>
            ) : (
              <CardTitle className="font-serif text-2xl">
                {earningsQ.data?.currency ?? "EUR"} {earningsQ.data?.total_amount ?? "0.00"}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {earningsQ.data ? `${earningsQ.data.payment_count} ${t.app.mentorDashboardHome.bookingPayments}` : ""}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardDescription>{t.app.mentorDashboardHome.onboardingPayment}</CardDescription>
            {onboardingQ.isLoading ? (
              <CardTitle className="font-serif text-2xl">{t.app.common.loading}</CardTitle>
            ) : latestOnboarding ? (
              <CardTitle className="font-serif text-2xl">
                {latestOnboarding.currency} {latestOnboarding.amount}
              </CardTitle>
            ) : (
              <CardTitle className="font-serif text-2xl">{t.app.mentorDashboardHome.noTransaction}</CardTitle>
            )}
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {latestOnboarding ? (
              <div className="space-y-1">
                <p>
                  {t.app.mentorDashboardHome.statusLabel}:{" "}
                  <span className="font-medium capitalize text-foreground/80">{latestOnboarding.status}</span>
                </p>
                <p>
                  {t.app.mentorDashboardHome.platformOnboardingLabel}:{" "}
                  <span className={`font-medium ${onboardingDone ? "text-green-700" : "text-amber-700"}`}>
                    {onboardingDone ? t.app.mentorDashboardHome.completed : t.app.mentorDashboardHome.pending}
                  </span>
                </p>
              </div>
            ) : (
              t.app.mentorDashboardHome.noOnboardingPayment
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>{t.app.mentorDashboardHome.earningsOverTime}</CardTitle>
                <CardDescription>
                  {t.app.mentorDashboardHome.bookingsPlusChat} ·{" "}
                  {seriesQ.data ? new Date(seriesQ.data.range_start).toLocaleString() : ""}{" "}
                  {seriesQ.data ? `→ ${new Date(seriesQ.data.range_end).toLocaleString()}` : ""}
                </CardDescription>
              </div>
              <Tabs value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}>
                <TabsList>
                  <TabsTrigger value="day">{t.app.mentorDashboardHome.day}</TabsTrigger>
                  <TabsTrigger value="week">{t.app.mentorDashboardHome.week}</TabsTrigger>
                  <TabsTrigger value="month">{t.app.mentorDashboardHome.month}</TabsTrigger>
                  <TabsTrigger value="year">{t.app.mentorDashboardHome.year}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {seriesQ.isLoading ? (
              <p className="text-sm text-muted-foreground">{t.app.mentorDashboardHome.loadingChart}</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.app.mentorDashboardHome.noEarningsInRange}</p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="bookings" name={t.app.mentorDashboardHome.bookingsLegend} stroke="hsl(90 8% 48%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="chat" name={t.app.mentorDashboardHome.chatLegend} stroke="hsl(90 15% 40%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="total" name={t.app.mentorDashboardHome.totalLegend} stroke="hsl(90 5% 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t.app.mentorDashboardHome.monthlyPlatformFees}</CardTitle>
            <CardDescription>{t.app.mentorDashboardHome.recentFeeInvoices}</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/mentor/invoices">{t.app.mentorDashboardHome.viewAll}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {invoicesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">{t.app.common.loading}</p>
          ) : recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.app.mentorDashboardHome.noMonthlyInvoices}</p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.invoice_month}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.app.mentorDashboardHome.grossLabel} {r.gross_revenue} {r.currency} · {t.app.mentorDashboardHome.feeLabel} {r.fee_amount} ({r.fee_percent}%)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">
                      {r.status}
                    </Badge>
                    {r.mollie_checkout_url && r.status !== "paid" ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => window.open(r.mollie_checkout_url ?? "", "_blank")}
                      >
                        {t.app.mentorDashboardHome.payNow}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

