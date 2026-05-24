import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { getPlatformPricing, listMentors } from "@/api/mentors";
import AppPageHeader from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { MentorSearchFilters, MentorSearchParams } from "@/components/MentorSearchFilters";
import { MentorBrowseCard } from "@/components/MentorBrowseCard";

const MentorsPage = () => {
  const { role, userAccessToken } = useAuth();
  const { t } = useLanguage();
  const p = t.app.mentorsPage;

  const [filters, setFilters] = useState<MentorSearchParams>({});

  const {
    data: mentors = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["mentors", "public", "page", import.meta.env.PROD, filters],
    queryFn: () => listMentors(import.meta.env.PROD, filters),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: pricing } = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: getPlatformPricing,
  });

  return (
    <div className="min-h-screen bg-cream/40 text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-accent">{p.directory}</p>
            <h1 className="font-serif text-4xl">{p.heading}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{p.sub}</p>
          </div>
          <div className="flex gap-2">
            {role !== "user" || !userAccessToken ? (
              <Button asChild variant="outline">
                <Link to="/user/register">{p.registerUser}</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/user/appointments">{p.myBookings}</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="w-full shrink-0 lg:w-80">
            <MentorSearchFilters filters={filters} onChange={setFilters} onClear={() => setFilters({})} />
          </div>

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <p className="animate-pulse font-serif text-xl italic text-muted-foreground">{p.loading}</p>
              </div>
            ) : isError ? (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-8 text-center text-destructive">
                {p.loadError}
                {error instanceof Error ? ` (${error.message})` : ""}
              </div>
            ) : mentors.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-8 text-center md:text-left">
                <h2 className="font-serif text-2xl">{p.emptyTitle}</h2>
                <p className="mt-3 max-w-3xl text-muted-foreground whitespace-pre-wrap">{p.emptyBody}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                {mentors.map((mentor) => (
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
        </div>
      </main>
    </div>
  );
};

export default MentorsPage;
