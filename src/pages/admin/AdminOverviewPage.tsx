import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminAnalytics, fetchAdminCoachApplications } from "@/api/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, FileUser, Star, UserRound, Users, Wallet } from "lucide-react";
import { formatDateLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";

const primaryStroke = "hsl(90 8% 48%)";

export default function AdminOverviewPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const effectiveTimeZone = useEffectiveTimeZone();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "analytics", "month"],
    queryFn: () => fetchAdminAnalytics("month"),
  });

  const coachAppsQ = useQuery({
    queryKey: ["admin", "coach-applications", "new-count"],
    queryFn: () => fetchAdminCoachApplications(0, 1, undefined, "new"),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  const { summary } = data;

  const cards = [
    { label: d.summaryBookings, value: summary.bookings, icon: CalendarDays },
    { label: d.summaryUsers, value: summary.new_users, icon: UserRound },
    { label: d.summaryMentors, value: summary.new_mentors, icon: Users },
    { label: d.summaryReviews, value: summary.reviews, icon: Star },
    { label: d.summaryRevenue, value: summary.revenue, icon: CreditCard },
    { label: d.summaryTotalUsers, value: summary.total_users, icon: UserRound },
    { label: d.summaryTotalMentors, value: summary.total_mentors, icon: Users },
    { label: d.summaryTotalPayments, value: summary.total_payments, icon: Wallet },
    { label: d.summaryPaidPayments, value: summary.paid_payments, icon: CheckCircle2 },
    { label: d.summaryPendingPayments, value: summary.pending_payments, icon: Clock3 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">{d.overview}</p>
        <h1 className="font-serif text-3xl">{d.overviewHeading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {d.last30Days} · {formatDateLocal(data.range_start, undefined, effectiveTimeZone)} – {formatDateLocal(data.range_end, undefined, effectiveTimeZone)}
        </p>
      </div>
      {(coachAppsQ.data?.total ?? 0) > 0 ? (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <FileUser className="h-5 w-5 text-accent" />
              <div>
                <p className="font-medium">{d.coachApplications}</p>
                <p className="text-sm text-muted-foreground">
                  {coachAppsQ.data?.total ?? 0} new submission{(coachAppsQ.data?.total ?? 0) === 1 ? "" : "s"} waiting for review
                </p>
              </div>
            </div>
            <Link
              to="/admin/coach-applications"
              className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent/80"
            >
              Review applications →
            </Link>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/60 glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4" style={{ color: primaryStroke }} />
            </CardHeader>
            <CardContent>
              <p className="font-serif text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
