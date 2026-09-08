import { ArrowRight, Clock, Globe, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthOptional } from "@/auth/AuthContext";
import { getMentorAvailabilityStatus, type MentorPublic, type PlatformPricing } from "@/api/types";
import { mediaUrlFromApi } from "@/lib/mediaUrl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { unknownListToStrings } from "@/lib/dbJsonFields";
import { normalizeCoachCardVisibility } from "@/lib/coachCardVisibility";
import { formatUnavailabilityLine } from "@/lib/mentorUnavailability";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { useLanguage } from "@/i18n/LanguageContext";

export type MentorBrowseCardProps = {
  mentor: MentorPublic;
  pricing: PlatformPricing | null | undefined;
  viewProfileLabel: string;
  consultNowLabel: string;
};

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function RatingStars({ value }: { value: number }) {
  const capped = Math.min(5, Math.max(0, value));
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = i <= capped;
    stars.push(
      <Star
        key={i}
        className={cn(
          "h-3.5 w-3.5",
          filled ? "fill-amber-400 text-amber-400" : "text-primary-foreground/25",
        )}
      />,
    );
  }
  return <span className="flex items-center gap-0.5">{stars}</span>;
}

/** Horizontal coach card themed with site accent/primary gradients */
export function MentorBrowseCard({ mentor, pricing, viewProfileLabel, consultNowLabel }: MentorBrowseCardProps) {
  const navigate = useNavigate();
  const auth = useAuthOptional();
  const { t } = useLanguage();
  const u = t.app.mentorUnavailability;
  const md = t.app.mentorDetail;
  const bc = t.app.mentorBrowseCard;
  const effectiveTimeZone = useEffectiveTimeZone();
  const role = auth?.role ?? null;
  const userAccessToken = auth?.userAccessToken ?? null;
  const availability = getMentorAvailabilityStatus(mentor);
  const unavailabilityLine = formatUnavailabilityLine(mentor.unavailability, u, {
    unavailableNow: availability === "unavailable",
    timeZone: effectiveTimeZone,
  });
  const nextAvailabilityLine = mentor.next_availability_at
    ? [
        formatDateLocal(
          mentor.next_availability_at,
          { weekday: "short", month: "short", day: "numeric" },
          effectiveTimeZone,
        ),
        [
          formatTimeLocal(mentor.next_availability_at, undefined, effectiveTimeZone),
          mentor.next_availability_end_at
            ? formatTimeLocal(mentor.next_availability_end_at, undefined, effectiveTimeZone)
            : null,
        ]
          .filter(Boolean)
          .join(" – "),
      ].join(" · ")
    : null;
  const cardVis = normalizeCoachCardVisibility(mentor.public_card_visibility);

  const expertise = unknownListToStrings(mentor.expertise_areas);
  const skills = unknownListToStrings(mentor.skills);
  const langs = unknownListToStrings(mentor.languages_spoken);
  const combinedTags = [...new Set([...expertise, ...skills])];

  const showPackages =
    cardVis.session_packages && Boolean(pricing?.is_active && mentor.session_packages_available);
  const pricingHint = !pricing
    ? bc.loadingPrices
    : !pricing.is_active
      ? bc.packagesPricingInactive
      : !cardVis.session_packages
        ? bc.packagesHiddenByCoach
        : !mentor.session_packages_available
          ? bc.packagesPendingApproval
          : null;

  const profileSrc = cardVis.profile_photo ? mediaUrlFromApi(mentor.profile_image) : null;
  const dedicatedBannerSrc = cardVis.banner_photo ? mediaUrlFromApi(mentor.banner_image) : null;
  // Prefer the portrait so faces stay in frame; use a wide banner only when there is no profile photo.
  const heroSrc = profileSrc ?? dedicatedBannerSrc ?? null;

  const roundedStars = Math.min(5, Math.max(0, Math.round(Number(mentor.average_rating) || 0)));
  const tags = combinedTags.slice(0, 4);
  const overflow = Math.max(0, combinedTags.length - tags.length);

  const goToProfile = () => navigate(`/mentors/${mentor.id}`);

  const onConsult = () => {
    if (availability !== "available") {
      goToProfile();
      return;
    }
    if (role !== "user" || !userAccessToken) {
      navigate("/login?role=user");
      return;
    }
    navigate(`/mentors/${mentor.id}#consult-open-slots`);
  };

  const consultLabel = availability === "available" ? consultNowLabel : md.seeWhenAvailable;

  return (
    <article
      className="group flex w-full max-w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md md:min-h-[280px] md:flex-row"
      onClick={goToProfile}
    >
      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-col justify-between gap-3 p-4 text-primary-foreground sm:p-5 md:p-6",
          "bg-gradient-to-br from-primary via-primary to-accent",
        )}
      >
        {/* subtle texture */}
        <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--muted),transparent_55%)]" />

        <div className="relative z-[1] min-w-0 space-y-2">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h2 className="min-w-0 break-words font-serif text-xl font-bold leading-tight tracking-tight text-primary-foreground sm:flex-1 sm:pr-2 sm:text-2xl">
              {mentor.full_name}
            </h2>
            <div className="flex w-full min-w-0 flex-col items-start gap-0.5 sm:w-auto sm:max-w-[11rem] sm:shrink-0 sm:items-end">
              <span
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                  availability === "unavailable"
                    ? "bg-amber-400/25 ring-amber-200/50"
                    : availability === "paused"
                      ? "bg-orange-400/25 ring-orange-200/50"
                      : "bg-primary-foreground/15 ring-primary-foreground/25",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    availability === "available"
                      ? "bg-emerald-400"
                      : availability === "busy"
                        ? "bg-rose-400"
                        : availability === "paused"
                          ? "bg-orange-400"
                          : availability === "unavailable"
                            ? "bg-amber-300"
                            : "bg-slate-300",
                  )}
                />
                {availability === "available"
                  ? bc.available
                  : availability === "busy"
                    ? bc.inSession
                    : availability === "paused"
                      ? bc.paused
                      : availability === "unavailable"
                        ? u.badge
                        : bc.offline}
              </span>
              {unavailabilityLine ? (
                <p className="text-left text-[10px] font-medium leading-tight text-primary-foreground/85 sm:text-right">
                  {unavailabilityLine}
                </p>
              ) : null}
              {nextAvailabilityLine ? (
                <p className="text-left text-[10px] font-medium leading-tight text-primary-foreground/85 sm:text-right">
                  {md.nextOnPlatform}: {nextAvailabilityLine}
                </p>
              ) : null}
            </div>
          </div>

          {cardVis.headline && mentor.headline ? (
            <p className="text-sm font-semibold leading-snug text-primary-foreground/95">{truncate(mentor.headline, 110)}</p>
          ) : null}

          {mentor.current_company ? (
            <p className="text-xs font-medium text-primary-foreground/80">{mentor.current_company}</p>
          ) : null}

          {langs.length > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-primary-foreground/80">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{langs.slice(0, 3).join(" · ")}</span>
            </p>
          ) : null}

          {cardVis.expertise_tags ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="border-0 bg-primary-foreground/15 text-[11px] font-medium text-primary-foreground hover:bg-primary-foreground/25"
              >
                {truncate(tag, 42)}
              </Badge>
            ))}
            {overflow > 0 ? (
              <Badge
                variant="secondary"
                className="border-0 bg-primary-foreground/20 text-[11px] font-semibold text-primary-foreground"
              >
                +{overflow}
              </Badge>
            ) : null}
          </div>
          ) : null}
        </div>

        <div className="relative z-[1] space-y-3">
            {cardVis.years_experience || cardVis.rating ? (
          <div className="flex flex-wrap items-center gap-4 text-xs text-primary-foreground/85">
            {cardVis.years_experience ? (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5" />
              {mentor.years_of_experience} {bc.years}
            </span>
            ) : null}
            {cardVis.rating ? (
            <span className="inline-flex items-center gap-2">
              <RatingStars value={roundedStars} />
              <span className="tabular-nums font-semibold">{mentor.average_rating}</span>
              <span className="text-primary-foreground/70">
                ({mentor.total_reviews} {bc.reviews})
              </span>
            </span>
            ) : null}
          </div>
          ) : null}

          {mentor.badges && mentor.badges.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {mentor.badges.map((badge) => (
                <Badge
                  key={badge}
                  variant="secondary"
                  className="border-0 bg-amber-300/25 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground"
                >
                  {badge}
                </Badge>
              ))}
            </div>
          ) : null}

          {showPackages && pricing ? (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md bg-primary-foreground/15 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
                5m · {pricing.currency}{" "}
                {pricing.price_5_min && Number(pricing.price_5_min) > 0
                  ? pricing.price_5_min
                  : (Number(pricing.price_10_min) / 2).toFixed(2)}
              </span>
              <span className="rounded-md bg-primary-foreground/15 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
                10m · {pricing.currency} {pricing.price_10_min}
              </span>
              <span className="rounded-md bg-primary-foreground/15 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
                20m · {pricing.currency} {pricing.price_20_min}
              </span>
              <span className="rounded-md bg-primary-foreground/15 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
                30m · {pricing.currency} {pricing.price_30_min}
              </span>
              <span className="rounded-md bg-primary-foreground/15 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
                60m · {pricing.currency}{" "}
                {pricing.price_60_min && Number(pricing.price_60_min) > 0
                  ? pricing.price_60_min
                  : (Number(pricing.price_30_min) * 2).toFixed(2)}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-primary-foreground/70">
              {pricingHint ?? bc.packagesUnavailable}
            </p>
          )}

          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                goToProfile();
              }}
            >
              {viewProfileLabel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full gap-1 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onConsult();
              }}
            >
              {consultLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative order-first aspect-[4/3] w-full max-h-[16rem] shrink-0 overflow-hidden bg-muted sm:max-h-[18rem] md:order-last md:aspect-auto md:h-auto md:max-h-none md:min-h-[280px] md:w-[40%] md:self-stretch lg:w-[38%]">
        {heroSrc ? (
          <>
            <img
              src={heroSrc}
              alt={mentor.full_name}
              className="absolute inset-0 h-full w-full object-cover object-[center_40%] md:object-[center_28%]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent md:bg-gradient-to-l md:from-transparent md:via-transparent md:to-black/40" />
          </>
        ) : (
          <div className="flex h-full min-h-[11rem] w-full items-center justify-center bg-gradient-to-br from-muted to-accent/25 text-muted-foreground md:min-h-0">
            {bc.photoComingSoon}
          </div>
        )}
        {dedicatedBannerSrc && profileSrc && heroSrc === dedicatedBannerSrc ? (
          <div className="absolute bottom-3 right-3 md:right-4">
            <img
              src={profileSrc}
              alt=""
              className="h-14 w-14 rounded-full border-4 border-card object-cover object-[center_28%] shadow-lg sm:h-16 sm:w-16 md:h-20 md:w-20"
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
