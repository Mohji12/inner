import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMentorAvailabilityStatus } from "@/api/types";
import { getPlatformPricing, listMentors } from "@/api/mentors";
import { MentorBrowseCard } from "@/components/MentorBrowseCard";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";

const HOME_COACH_LIMIT = 4;

function availabilitySortKey(status: ReturnType<typeof getMentorAvailabilityStatus>) {
  if (status === "available") return 0;
  if (status === "busy") return 1;
  return 2;
}

const CoachesSection = () => {
  const ref = useScrollReveal();
  const { t } = useLanguage();
  const p = t.app.mentorsPage;

  const { data: mentors = [], isLoading, isError } = useQuery({
    queryKey: ["mentors", "public", "home", import.meta.env.PROD],
    queryFn: () => listMentors(import.meta.env.PROD),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: pricing } = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: getPlatformPricing,
  });

  const featured = useMemo(
    () =>
      [...mentors]
        .sort(
          (a, b) =>
            availabilitySortKey(getMentorAvailabilityStatus(a)) -
            availabilitySortKey(getMentorAvailabilityStatus(b)),
        )
        .slice(0, HOME_COACH_LIMIT),
    [mentors],
  );

  return (
    <section id="coaches" className="bg-background/95 py-24 backdrop-blur-sm md:py-32">
      <div ref={ref} className="section-reveal container mx-auto px-6">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4 md:mb-16">
          <div className="max-w-2xl">
            <span className="text-sm font-medium uppercase tracking-widest text-accent">{t.coaches.label}</span>
            <h2 className="mt-3 text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
              {t.coaches.heading}
            </h2>
            <p className="mt-3 text-muted-foreground">{t.coaches.sub}</p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link to="/mentors">{t.coaches.viewAll}</Link>
          </Button>
        </div>

        {isLoading ? (
          <p className="animate-pulse py-16 text-center font-serif text-xl italic text-muted-foreground">
            {p.loading}
          </p>
        ) : isError ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 py-12 text-center text-destructive">
            {p.loadError}
          </p>
        ) : featured.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-8 text-center">
            <p className="font-serif text-xl">{p.emptyTitle}</p>
            <p className="mt-2 text-muted-foreground">{p.emptyBody}</p>
            <Button asChild className="mt-6 gradient-cta text-white">
              <Link to="/mentors">{t.coaches.viewAll}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            {featured.map((mentor) => (
              <MentorBrowseCard
                key={mentor.id}
                mentor={mentor}
                pricing={pricing}
                viewProfileLabel={p.viewProfile}
                consultNowLabel={p.consultNow}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CoachesSection;
