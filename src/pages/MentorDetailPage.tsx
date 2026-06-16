import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { createBooking } from "@/api/bookings";
import { getMentor, getPlatformPricing, getSimilarMentors, joinWaitlist, leaveWaitlist, getWaitlistPosition } from "@/api/mentors";
import type { MentorDetail, MentorPublic } from "@/api/types";
import { getMentorAvailabilityStatus, sessionPackageEur } from "@/api/types";
import { unknownListToStrings } from "@/lib/dbJsonFields";
import AppPageHeader from "@/components/AppPageHeader";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Phone, Video } from "lucide-react";
import { formatDateLocal, formatTimeLocal, isSameCalendarDayLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { LiveSessionWindowPreview } from "@/components/LiveSessionWindowPreview";

const SESSION_PACKAGES = [5, 10, 20, 30, 60] as const;
type LiveCommunicationMode = "video" | "call";

function tagList(m: MentorDetail, key: keyof MentorDetail): string[] {
  return unknownListToStrings(m[key]);
}

const MentorDetailPage = () => {
  const { mentorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, userAccessToken } = useAuth();
  const [selectedDuration, setSelectedDuration] = useState<(typeof SESSION_PACKAGES)[number]>(5);
  const effectiveTimeZone = useEffectiveTimeZone();

  const { data: mentor, isLoading: loadingMentor } = useQuery({
    queryKey: ["mentor", mentorId],
    queryFn: () => getMentor(mentorId!),
    enabled: Boolean(mentorId),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const { data: pricing } = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: getPlatformPricing,
  });

  const { data: waitlistData } = useQuery({
    queryKey: ["mentor", mentorId, "waitlist"],
    queryFn: () => getWaitlistPosition(mentorId!),
    enabled: Boolean(mentorId) && role === "user" && Boolean(userAccessToken),
  });

  const joinWaitlistMut = useMutation({
    mutationFn: () => joinWaitlist(mentorId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor", mentorId, "waitlist"] });
      toast.success("You joined the waitlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveWaitlistMut = useMutation({
    mutationFn: () => leaveWaitlist(mentorId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor", mentorId, "waitlist"] });
      toast.success("You left the waitlist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleBookingError = (e: Error) => {
    const lower = e.message.toLowerCase();
    if (lower.includes("offline")) {
      toast.error("This coach is offline. Book when they are online on the platform.");
      return;
    }
    if (lower.includes("mentor is currently in a chat session") || lower.includes("mentor_in_chat")) {
      toast.error("This coach is currently in another session. Please try again shortly.");
      return;
    }
    toast.error(e.message);
  };

  const liveBookMut = useMutation({
    mutationFn: ({
      durationMinutes,
      communicationMode,
    }: {
      durationMinutes: number;
      communicationMode: LiveCommunicationMode;
    }) =>
      createBooking({
        mentor_id: mentorId!,
        duration_minutes: durationMinutes,
        communication_mode: communicationMode,
      }),
    onSuccess: (booking) => {
      toast.success("Redirecting to payment…");
      navigate(`/payment/${mentorId}?bookingId=${booking.id}`);
    },
    onError: handleBookingError,
  });

  if (loadingMentor || !mentorId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="animate-pulse font-serif text-xl italic text-muted-foreground">Loading coach profile…</p>
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppPageHeader />
        <main className="container mx-auto px-6 py-10">
          <Card className="mx-auto max-w-2xl">
            <CardHeader>
              <CardTitle className="font-serif text-3xl">Coach not found</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/mentors">Back to coaches</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const langs = tagList(mentor, "languages_spoken");
  const expertise = tagList(mentor, "expertise_areas");
  const skills = tagList(mentor, "skills");
  const sessionModes = tagList(mentor, "session_modes");
  const tools = tagList(mentor, "tools_technologies");
  const availability = getMentorAvailabilityStatus(mentor);
  const mentorBusy = availability === "busy";
  const mentorOffline = availability === "offline";
  const canBookLive = availability === "available";

  const handleDurationSelect = (minutes: (typeof SESSION_PACKAGES)[number]) => {
    if (role !== "user" || !userAccessToken) {
      toast.message("Please log in as a user to book.");
      navigate("/login?role=user");
      return;
    }
    setSelectedDuration(minutes);
  };

  const handleLiveBook = (communicationMode: LiveCommunicationMode) => {
    if (role !== "user" || !userAccessToken) {
      toast.message("Please log in as a user to book.");
      navigate("/login?role=user");
      return;
    }
    if (mentorOffline) {
      toast.error("This coach is offline. You can book only while they are online on the platform.");
      return;
    }
    if (mentorBusy) {
      toast.error("This coach is currently in another session. Please try again shortly.");
      return;
    }
    liveBookMut.mutate({ durationMinutes: selectedDuration, communicationMode });
  };

  const userLoggedIn = role === "user" && Boolean(userAccessToken);
  const bookSessionDisabled = userLoggedIn && (mentorBusy || mentorOffline);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-4xl border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-widest text-accent">Coach profile</p>
                <div className="flex items-center gap-4">
                  <CardTitle className="font-serif text-4xl">{mentor.full_name}</CardTitle>
                  <FavoriteButton mentorId={mentor.id} className="mt-1" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {availability === "available" ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                      <PresenceIndicator status="online" />
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Online — book now</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Coach is on the platform and available</p>
                  </div>
                ) : availability === "busy" ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                      <PresenceIndicator status="busy" />
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">In session</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Coach is in another live session</p>
                  </div>
                ) : mentor.last_seen_at ? (
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold bg-muted/50 px-2 py-0.5 rounded border border-border/50">
                    Last seen {isSameCalendarDayLocal(mentor.last_seen_at, new Date(), effectiveTimeZone)
                      ? formatTimeLocal(mentor.last_seen_at, undefined, effectiveTimeZone)
                      : formatDateLocal(mentor.last_seen_at, { month: "short", day: "numeric" }, effectiveTimeZone)}
                  </div>
                ) : mentorOffline ? (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
                      <PresenceIndicator status="offline" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Offline</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Coach is not on the platform right now</p>
                  </div>
                ) : null}
              </div>
            </div>
            <p className="text-muted-foreground">{mentor.headline ?? ""}</p>
            {mentor.current_company ? (
              <p className="text-sm text-muted-foreground">Currently at {mentor.current_company}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            {mentor.bio ? <p>{mentor.bio}</p> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 p-4">
                <p className="mb-2 text-sm uppercase tracking-widest text-accent">Details</p>
                <p className="text-sm text-muted-foreground">Experience: {mentor.years_of_experience} years</p>
                <p className="text-sm text-muted-foreground">
                  Rating: {mentor.average_rating} · Reviews: {mentor.total_reviews}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="mb-2 text-sm uppercase tracking-widest text-accent">Languages</p>
                <div className="flex flex-wrap gap-2">
                  {langs.length > 0 ? (
                    langs.map((language) => (
                      <Badge key={language} variant="secondary">
                        {language}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </div>

            {(expertise.length > 0 || skills.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {expertise.length > 0 ? (
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="mb-2 text-sm uppercase tracking-widest text-accent">Expertise</p>
                    <div className="flex flex-wrap gap-2">
                      {expertise.map((x) => (
                        <Badge key={x} variant="outline">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {skills.length > 0 ? (
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="mb-2 text-sm uppercase tracking-widest text-accent">Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {skills.map((x) => (
                        <Badge key={x} variant="secondary">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {(sessionModes.length > 0 || tools.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {sessionModes.length > 0 ? (
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="mb-2 text-sm uppercase tracking-widest text-accent">Session modes</p>
                    <div className="flex flex-wrap gap-2">
                      {sessionModes.map((x) => (
                        <Badge key={x} variant="outline">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {tools.length > 0 ? (
                  <div className="rounded-xl border border-border/70 p-4">
                    <p className="mb-2 text-sm uppercase tracking-widest text-accent">Tools</p>
                    <div className="flex flex-wrap gap-2">
                      {tools.map((x) => (
                        <Badge key={x} variant="secondary">
                          {x}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="mb-3 text-sm uppercase tracking-widest text-accent">Live session pricing (EUR)</p>
              {pricing ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {SESSION_PACKAGES.map((mins) => {
                      const amount = sessionPackageEur(mentor, pricing, mins);
                      const isSelected = selectedDuration === mins;
                      const pricingLocked = !pricing.is_active || !canBookLive;
                      return (
                        <Button
                          key={mins}
                          type="button"
                          variant={isSelected && !pricingLocked ? "default" : "outline"}
                          className={
                            pricingLocked
                              ? "h-auto min-h-[4.75rem] flex-col gap-0.5 border-2 border-dashed border-border/80 bg-background/80 py-3 text-center font-normal text-muted-foreground opacity-80"
                              : isSelected
                                ? "gradient-cta text-white flex h-auto min-h-[4.75rem] flex-col gap-0.5 py-3 text-center font-normal shadow-md ring-2 ring-accent/40"
                                : "flex h-auto min-h-[4.75rem] flex-col gap-0.5 border-2 border-border/80 bg-background py-3 text-center font-normal hover:border-accent/50"
                          }
                          disabled={pricingLocked}
                          title={
                            !pricing.is_active
                              ? "Session checkout is disabled"
                              : mentorOffline
                                ? "Coach is offline — booking unavailable"
                                : mentorBusy
                                  ? "Coach is in another session"
                                  : `Select ${mins}-minute session`
                          }
                          onClick={() => handleDurationSelect(mins)}
                        >
                          <span className="text-sm font-semibold tracking-wide">{mins} mins</span>
                          <span
                            className={
                              pricingLocked ? "text-base font-semibold" : "text-base font-bold text-white"
                            }
                          >
                            {pricing.currency} {amount.toFixed(2)}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                  {!pricing.is_active ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Packages appear when platform session pricing is active.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Choose a duration, then start an in-app <strong className="text-foreground">video meeting</strong> (mic
                      + camera) or <strong className="text-foreground">voice meeting</strong> (mic only, no video). Chat
                      works in both. Your session starts at the current local time once payment is complete.
                    </p>
                  )}
                  {pricing?.is_active && canBookLive ? (
                    <div className="mt-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                      <LiveSessionWindowPreview durationMinutes={selectedDuration} className="text-xs" />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Pricing unavailable right now.</p>
              )}
              {Number(mentor.chat_price_per_minute) > 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Flexible chat:{" "}
                  <span className="font-medium text-foreground">
                    {mentor.chat_price_per_minute} {mentor.chat_currency}/min
                  </span>
                  {mentor.chat_min_purchase_minutes ? (
                    <span> · minimum purchase {mentor.chat_min_purchase_minutes} min</span>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/mentors">Back</Link>
              </Button>
              <Button
                type="button"
                className="gradient-cta text-white disabled:opacity-60"
                disabled={bookSessionDisabled || liveBookMut.isPending || !pricing?.is_active}
                title={
                  mentorOffline
                    ? "Coach is offline"
                    : mentorBusy
                      ? "Coach is currently in another session"
                      : `Book ${selectedDuration}-minute video session`
                }
                onClick={() => handleLiveBook("video")}
              >
                <Video className="mr-2 h-4 w-4" />
                Video
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="disabled:opacity-60"
                disabled={bookSessionDisabled || liveBookMut.isPending || !pricing?.is_active}
                title={
                  mentorOffline
                    ? "Coach is offline"
                    : mentorBusy
                      ? "Coach is currently in another session"
                      : `Book ${selectedDuration}-minute voice call`
                }
                onClick={() => handleLiveBook("call")}
              >
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            </div>
          </CardContent>
        </Card>

        <SimilarCoaches mentorId={mentor.id} />
      </main>
    </div>
  );
};

export default MentorDetailPage;

function SimilarCoaches({ mentorId }: { mentorId: string }) {
  const navigate = useNavigate();
  const { data: mentors = [], isLoading } = useQuery({
    queryKey: ["mentors", "similar", mentorId],
    queryFn: () => getSimilarMentors(mentorId),
    enabled: Boolean(mentorId),
  });

  if (isLoading || mentors.length === 0) return null;

  return (
    <div className="mt-12">
      <h3 className="text-2xl font-serif mb-6">Similar Coaches</h3>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {mentors.map((m) => (
          <Card key={m.id} className="cursor-pointer hover:-translate-y-1 transition-transform" onClick={() => navigate(`/mentors/${m.id}`)}>
            <CardHeader className="p-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{m.full_name}</CardTitle>
                <span className="inline-flex items-center gap-1">
                  <span
                    className={
                      getMentorAvailabilityStatus(m) === "available"
                        ? "h-2 w-2 rounded-full bg-emerald-500"
                        : getMentorAvailabilityStatus(m) === "busy"
                          ? "h-2 w-2 rounded-full bg-rose-500"
                          : "h-2 w-2 rounded-full bg-slate-400"
                    }
                  />
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{m.headline}</p>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
