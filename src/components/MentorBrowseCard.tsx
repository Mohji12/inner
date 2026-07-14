import { ArrowRight, Clock, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthOptional } from "@/auth/AuthContext";
import { getMentorAvailabilityStatus, type MentorPublic, type PlatformPricing } from "@/api/types";
import { mediaUrlFromApi } from "@/lib/mediaUrl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { unknownListToStrings } from "@/lib/dbJsonFields";
import { normalizeCoachCardVisibility } from "@/lib/coachCardVisibility";

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
  const role = auth?.role ?? null;
  const userAccessToken = auth?.userAccessToken ?? null;
  const availability = getMentorAvailabilityStatus(mentor);
  const cardVis = normalizeCoachCardVisibility(mentor.public_card_visibility);

  const expertise = unknownListToStrings(mentor.expertise_areas);
  const skills = unknownListToStrings(mentor.skills);
  const combinedTags = [...new Set([...expertise, ...skills])];

  const showPackages =
    cardVis.session_packages && Boolean(pricing?.is_active && mentor.session_packages_available);
  const pricingHint = !pricing
    ? "Loading session prices..."
    : !pricing.is_active
      ? "Packages are hidden because platform pricing is currently inactive."
      : !mentor.session_packages_available
        ? "Packages are hidden until this coach account is approved and active."
        : null;

  const bannerSrc =
    cardVis.banner_photo && (mediaUrlFromApi(mentor.banner_image) ?? (cardVis.profile_photo ? mediaUrlFromApi(mentor.profile_image) : null));
  const profileSrc = cardVis.profile_photo ? mediaUrlFromApi(mentor.profile_image) : null;

  const roundedStars = Math.min(5, Math.max(0, Math.round(Number(mentor.average_rating) || 0)));
  const tags = combinedTags.slice(0, 2);
  const overflow = Math.max(0, combinedTags.length - tags.length);

  const onConsult = () => {
    if (role !== "user" || !userAccessToken) {
      navigate("/login?role=user");
      return;
    }
    navigate(`/mentors/${mentor.id}#consult-open-slots`);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md md:flex-row md:min-h-[220px]">
      <div
        className={cn(
          "relative flex flex-1 flex-col justify-between gap-3 p-6 text-primary-foreground",
          "bg-gradient-to-br from-primary via-primary to-accent",
        )}
      >
        {/* subtle texture */}
        <div className="pointer-events-none absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--muted),transparent_55%)]" />

        <div className="relative z-[1] space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-serif text-2xl font-bold leading-tight tracking-tight text-primary-foreground">
              {mentor.full_name}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-primary-foreground/25">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  availability === "available"
                    ? "bg-emerald-400"
                    : availability === "busy"
                      ? "bg-rose-400"
                      : "bg-slate-300",
                )}
              />
              {availability === "available" ? "Available" : availability === "busy" ? "In session" : "Offline"}
            </span>
          </div>

          {cardVis.headline && mentor.headline ? (
            <p className="text-sm font-semibold leading-snug text-primary-foreground/95">{truncate(mentor.headline, 90)}</p>
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
              {mentor.years_of_experience} years
            </span>
            ) : null}
            {cardVis.rating ? (
            <span className="inline-flex items-center gap-2">
              <RatingStars value={roundedStars} />
              <span className="tabular-nums font-semibold">{mentor.average_rating}</span>
            </span>
            ) : null}
          </div>
          ) : null}

          {showPackages && pricing ? (
            <div className="flex flex-wrap gap-2">
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
              {pricingHint ?? "Packages unavailable right now."}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              onClick={() => navigate(`/mentors/${mentor.id}`)}
            >
              {viewProfileLabel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              disabled={availability !== "available"}
              onClick={onConsult}
            >
              {consultNowLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative h-56 w-full shrink-0 overflow-hidden bg-muted md:h-auto md:w-[42%] md:min-h-[220px]">
        {bannerSrc ? (
          <>
            <img src={bannerSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/35 md:to-black/55" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent/25 text-muted-foreground">
            Photo coming soon
          </div>
        )}
        {/* overlay avatar when we have banner + profile */}
        {mentor.banner_image && cardVis.banner_photo && profileSrc && cardVis.profile_photo ? (
          <div className="absolute bottom-3 right-3 md:right-4">
            <img
              src={profileSrc}
              alt=""
              className="h-16 w-16 rounded-full border-4 border-card object-cover shadow-lg md:h-20 md:w-20"
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}
