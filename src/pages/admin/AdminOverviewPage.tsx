import { Link } from "react-router-dom";
import { useMemo, useState, type ComponentType, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminAnalytics } from "@/api/admin";
import {
  AdminEntityFilters,
  emptyAdminEntityFilters,
  toAdminEntityApiFilters,
} from "@/components/admin/AdminEntityFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashboardPerson } from "@/hooks/useDashboardPerson";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileUser,
  MessageSquare,
  Star,
  UserCheck,
  UserRound,
  Users,
  UserX,
  Wallet,
} from "lucide-react";
import { formatDateLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { UrlVisitTable } from "@/components/admin/UrlVisitTable";

const primaryStroke = "hsl(90 8% 48%)";

type KpiCard = {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
};

function KpiGrid({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  );
}

export default function AdminOverviewPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const personName = useDashboardPerson(d.role);
  const effectiveTimeZone = useEffectiveTimeZone();

  const [draft, setDraft] = useState(emptyAdminEntityFilters);
  const [applied, setApplied] = useState(emptyAdminEntityFilters);

  const apiFilters = useMemo(() => toAdminEntityApiFilters(applied), [applied]);
  const hasCustomDates = Boolean(applied.dateFrom || applied.dateTo);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["admin", "analytics", "month", apiFilters],
    queryFn: () => fetchAdminAnalytics("month", apiFilters),
  });

  const summary = data?.summary;
  const newApplications = summary?.new_coach_applications ?? 0;
  const rangeLabel = hasCustomDates ? d.filteredRange : d.last30Days;

  const trafficCards: KpiCard[] = summary
    ? [
        { label: d.summaryPageViews, value: summary.page_views ?? 0, icon: Eye },
        { label: d.summaryUniqueVisitors, value: summary.unique_visitors ?? 0, icon: Users },
        { label: d.summaryChats, value: summary.chats ?? 0, icon: MessageSquare },
      ]
    : [];

  const activityCards: KpiCard[] = summary
    ? [
        { label: d.summaryBookings, value: summary.bookings, icon: CalendarDays },
        { label: d.summaryReviews, value: summary.reviews, icon: Star },
        { label: d.summaryRevenue, value: summary.revenue, icon: CreditCard },
      ]
    : [];

  const userCards: KpiCard[] = summary
    ? [
        { label: d.summaryUsers, value: summary.new_users, icon: UserRound },
        { label: d.summaryTotalUsers, value: summary.total_users, icon: UserRound },
      ]
    : [];

  const coachCards: KpiCard[] = summary
    ? [
        { label: d.summaryMentors, value: summary.new_mentors, icon: Users },
        { label: d.summaryTotalMentors, value: summary.total_mentors, icon: Users },
        { label: d.summaryActiveMentors, value: summary.active_mentors, icon: UserCheck },
        { label: d.summaryPendingMentors, value: summary.pending_mentors, icon: Clock3 },
        { label: d.summaryRejectedMentors, value: summary.rejected_mentors, icon: UserX },
        { label: d.summaryNewCoachApplications, value: summary.new_coach_applications, icon: FileUser },
      ]
    : [];

  const paymentCards: KpiCard[] = summary
    ? [
        { label: d.summaryTotalPayments, value: summary.total_payments, icon: Wallet },
        { label: d.summaryPaidPayments, value: summary.paid_payments, icon: CheckCircle2 },
        { label: d.summaryPendingPayments, value: summary.pending_payments, icon: Clock3 },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">{d.overview}</p>
        <h1 className="font-serif text-3xl">{d.welcomeBackNamed.replace("{name}", personName)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data
            ? `${rangeLabel} · ${formatDateLocal(data.range_start, undefined, effectiveTimeZone)} – ${formatDateLocal(data.range_end, undefined, effectiveTimeZone)}`
            : rangeLabel}
          {isFetching ? ` · ${d.tableLoading}` : ""}
        </p>
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

      {newApplications > 0 ? (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-3">
              <FileUser className="h-5 w-5 text-accent" />
              <div>
                <p className="font-medium">{d.coachApplications}</p>
                <p className="text-sm text-muted-foreground">
                  {d.overviewBanner.replace("{count}", String(newApplications))}
                </p>
              </div>
            </div>
            <Link
              to="/admin/coach-applications"
              className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent/80"
            >
              {d.reviewApplications}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <>
          <section className="space-y-3">
            <h2 className="font-serif text-xl">{d.sectionTraffic}</h2>
            <p className="text-sm text-muted-foreground">{d.visitsNote}</p>
            <KpiGrid cards={trafficCards} />
            {(data.top_pages ?? []).length > 0 ? (
              <Card className="border-border/60 glass-card">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">{d.topPages}</CardTitle>
                  <p className="text-sm font-normal text-muted-foreground">{d.urlClicksHint}</p>
                </CardHeader>
                <CardContent>
                  <UrlVisitTable
                    rows={(data.top_pages ?? []).slice(0, 12).map((row) => ({
                      label: row.path,
                      views: row.views,
                      unique_visitors: row.unique_visitors,
                    }))}
                    urlLabel={d.urlColumn}
                    viewsLabel={d.topPagesViews}
                    visitorsLabel={d.topPagesVisitors}
                    emptyLabel={d.noData}
                  />
                  <p className="mt-3 text-sm">
                    <Link to="/admin/analytics" className="text-accent underline underline-offset-4">
                      {d.viewAllUrlClicks}
                    </Link>
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl">{d.sectionActivity}</h2>
            <KpiGrid cards={activityCards} />
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl">{d.sectionUsers}</h2>
            <KpiGrid cards={userCards} />
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl">{d.sectionCoaches}</h2>
            <KpiGrid cards={coachCards} />
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl">{d.sectionPayments}</h2>
            <KpiGrid cards={paymentCards} />
          </section>
        </>
      ) : null}
    </div>
  );
}
