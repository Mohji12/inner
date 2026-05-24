import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, MessageSquare, Receipt, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useMemo, useState } from "react";
import { getUserDashboardStats, getUserSpendingSeries, type AnalyticsPeriod } from "@/api/users";
import { listUserBookings } from "@/api/bookings";
import { getMentor, getPlatformPricing } from "@/api/mentors";
import type { Booking, MentorDetail, PlatformPricing } from "@/api/types";
import { slotPriceForDuration } from "@/api/types";
import { getMyWallet } from "@/api/wallets";
import { listChatInvoices } from "@/api/chat";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";

const UserDashboardHomePage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const du = t.app.dashboardUser;
  const effectiveTimeZone = useEffectiveTimeZone();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["user-dashboard-stats"],
    queryFn: getUserDashboardStats,
  });

  const [period, setPeriod] = useState<AnalyticsPeriod>("month");
  const spendingQ = useQuery({
    queryKey: ["user", "spending-series", period],
    queryFn: () => getUserSpendingSeries(period),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", "me", "recent"],
    queryFn: listUserBookings,
  });

  const mentorQueries = useQuery({
    queryKey: ["mentors-for-dashboard-bookings", bookings.map((b) => b.mentor_id).join(",")],
    queryFn: async () => {
      const map = new Map<string, MentorDetail>();
      const ids = [...new Set(bookings.map((b) => b.mentor_id))];
      await Promise.all(
        ids.map(async (id) => {
          const m = await getMentor(id);
          map.set(id, m);
        }),
      );
      return map;
    },
    enabled: bookings.length > 0,
  });

  const pricingQ = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: getPlatformPricing,
  });

  const walletQ = useQuery({
    queryKey: ["wallet", "me", "summary"],
    queryFn: () => getMyWallet(0, 5),
  });

  const invoicesQ = useQuery({
    queryKey: ["chat", "invoices", "summary"],
    queryFn: listChatInvoices,
  });

  const chartData = useMemo(() => {
    const data = spendingQ.data;
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
  }, [spendingQ.data]);

  const mentorMap = mentorQueries.data ?? new Map<string, MentorDetail>();
  const recentBookings: Booking[] = (bookings ?? []).slice(0, 5);
  const recentInvoices = (invoicesQ.data ?? []).slice(0, 5);

  const pricing: PlatformPricing | null = (pricingQ.data as PlatformPricing | undefined) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-bold">Welcome back, {user?.first_name || "User"}!</h1>
        <p className="text-muted-foreground mt-1">Here's an overview of your progress and upcoming activities.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Session</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : stats?.upcoming_session ? (
              <div>
                <div className="text-xl font-bold truncate">{stats.upcoming_session.mentor_name}</div>
                <p className="text-xs text-muted-foreground">
                  {formatDateLocal(stats.upcoming_session.date, undefined, effectiveTimeZone)} at{" "}
                  {formatTimeLocal(`${stats.upcoming_session.date}T${stats.upcoming_session.start_time}Z`, undefined, effectiveTimeZone)}
                </p>
              </div>
            ) : (
              <div>
                <div className="text-lg font-bold text-muted-foreground">None</div>
                <p className="text-xs text-muted-foreground">No upcoming sessions</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total_sessions || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Sessions completed</p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">€{stats?.total_spent?.toFixed(2) || "0.00"}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Lifetime investment</p>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.active_chats || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Ongoing conversations</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>What would you like to do today?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/user/mentors">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> {du.browseMentors}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/user/appointments">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> View Appointments
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full justify-between" variant="outline">
              <Link to="/user/messages">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Open Messages
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle>Spending over time</CardTitle>
                <CardDescription>
                  Bookings + text chat purchases · {spendingQ.data ? new Date(spendingQ.data.range_start).toLocaleString() : ""}{" "}
                  {spendingQ.data ? `→ ${new Date(spendingQ.data.range_end).toLocaleString()}` : ""}
                </CardDescription>
              </div>
              <Tabs value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}>
                <TabsList>
                  <TabsTrigger value="day">Day</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="year">Year</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {spendingQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading chart…</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spend data in this range.</p>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="bookings" name="Bookings" stroke="hsl(90 8% 48%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="chat" name="Text chat" stroke="hsl(90 15% 40%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="hsl(90 5% 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent bookings</CardTitle>
            <CardDescription>Your latest session requests and appointments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <div className="space-y-2">
                {recentBookings.map((b) => {
                  const mentor = mentorMap.get(b.mentor_id);
                  const amount = pricing ? slotPriceForDuration(pricing, b.duration) : null;
                  return (
                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{mentor?.full_name ?? "Coach"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateLocal(b.start_at_utc, { year: "numeric", month: "2-digit", day: "2-digit" }, effectiveTimeZone)} ·{" "}
                          {formatTimeLocal(b.start_at_utc, undefined, effectiveTimeZone)} · {b.duration} min
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize">
                          {b.status}
                        </Badge>
                        {amount != null ? (
                          <span className="text-sm font-medium">EUR {amount.toFixed(2)}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                        <Button asChild size="sm" variant="outline">
                          <Link to="/user/appointments">Open</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
            <CardDescription>Balance + last 5 transactions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {walletQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading wallet…</p>
            ) : walletQ.data ? (
              <>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Balance</p>
                  <p className="mt-1 font-serif text-2xl font-semibold">
                    {walletQ.data.currency} {walletQ.data.balance.toFixed(2)}
                  </p>
                </div>
                {walletQ.data.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No wallet transactions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {walletQ.data.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-muted-foreground">{tx.description}</span>
                        <span className={tx.type === "credit" ? "text-green-600" : "text-red-600"}>
                          {tx.type === "credit" ? "+" : "-"}
                          {walletQ.data.currency} {tx.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <Button asChild variant="outline" className="w-full">
                  <Link to="/user/wallet">Open wallet</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-destructive">Failed to load wallet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Chat invoices</CardTitle>
            <CardDescription>Latest paid text chat invoice rows.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/user/transactions">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {invoicesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading invoices…</p>
          ) : recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chat invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((r) => (
                <div key={r.session_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{r.invoice_number}</p>
                    <p className="font-medium truncate">{r.mentor_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.total_minutes_purchased} min · {r.total_amount} {r.currency}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {r.payment_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserDashboardHomePage;
