import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { createBooking, validatePromoCode } from "@/api/bookings";
import { startChatSession } from "@/api/chat";
import { getWelcomePromo } from "@/api/users";
import {
  getMentor,
  getPlatformPricing,
  getSimilarMentors,
  joinWaitlist,
  leaveWaitlist,
  getWaitlistPosition,
  listMentorAvailabilityWindows,
} from "@/api/mentors";
import type { MentorDetail, MentorPublic } from "@/api/types";
import { getMentorAvailabilityStatus, sessionPackageEur } from "@/api/types";
import { unknownListToStrings } from "@/lib/dbJsonFields";
import { mediaUrlFromApi } from "@/lib/mediaUrl";
import { stashPendingMolliePaymentId } from "@/lib/molliePendingPayment";
import AppPageHeader from "@/components/AppPageHeader";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageCircle, Phone, Video, ArrowLeft } from "lucide-react";
import { formatDateLocal, formatTimeLocal, isSameCalendarDayLocal } from "@/lib/timeZone";
import { formatUnavailabilityLine } from "@/lib/mentorUnavailability";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { LiveSessionWindowPreview } from "@/components/LiveSessionWindowPreview";
import { humanizeApiError } from "@/lib/humanizeApiError";
import { useLanguage } from "@/i18n/LanguageContext";

const SESSION_PACKAGES = [5, 10, 20, 30, 60] as const;
type LiveCommunicationMode = "video" | "call";

function tagList(m: MentorDetail, key: keyof MentorDetail): string[] {
  return unknownListToStrings(m[key]);
}

function ChipBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-border/70 p-4">
      <p className="mb-2 text-sm uppercase tracking-widest text-accent">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="max-w-full whitespace-normal break-words">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

const MentorDetailPage = () => {
  const { mentorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, userAccessToken } = useAuth();
  const { t, language } = useLanguage();
  const md = t.app.mentorDetail;
  const p = t.app.payment;
  const u = t.app.mentorUnavailability;
  const [selectedDuration, setSelectedDuration] = useState<(typeof SESSION_PACKAGES)[number]>(5);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availabilityBlockReason, setAvailabilityBlockReason] = useState<
    "busy" | "paused" | "unavailable" | "offline" | null
  >(null);
  const [chatPromoInput, setChatPromoInput] = useState("");
  const [chatPromoCode, setChatPromoCode] = useState("");
  const [chatPromoError, setChatPromoError] = useState("");
  const [chatPromoDiscount, setChatPromoDiscount] = useState(0);
  const [chatPromoFinal, setChatPromoFinal] = useState<number | null>(null);
  const [validatingChatPromo, setValidatingChatPromo] = useState(false);
  const welcomeChatPromoAppliedRef = useRef(false);
  const effectiveTimeZone = useEffectiveTimeZone();

  const { data: mentor, isLoading: loadingMentor } = useQuery({
    queryKey: ["mentor", mentorId, language],
    queryFn: () => getMentor(mentorId!),
    enabled: Boolean(mentorId),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    staleTime: 8_000,
  });

  const availability = mentor ? getMentorAvailabilityStatus(mentor) : "offline";
  const mentorBusy = availability === "busy";
  const mentorPaused = availability === "paused";
  const mentorOffline = availability === "offline";
  const mentorUnavailable = availability === "unavailable";
  const canBookLive = availability === "available";
  const dialogBusy = availabilityBlockReason === "busy" || (!availabilityBlockReason && mentorBusy);
  const dialogPaused = availabilityBlockReason === "paused" || (!availabilityBlockReason && mentorPaused);
  const dialogUnavailable =
    availabilityBlockReason === "unavailable" || (!availabilityBlockReason && mentorUnavailable);
  const unavailabilityLine = mentor
    ? formatUnavailabilityLine(mentor.unavailability, u, {
        unavailableNow: mentorUnavailable,
        timeZone: effectiveTimeZone,
      })
    : "";

  const refreshMentorAvailability = async () => {
    if (!mentorId) return "offline" as const;
    const fresh = await queryClient.fetchQuery({
      queryKey: ["mentor", mentorId, language],
      queryFn: () => getMentor(mentorId),
    });
    return getMentorAvailabilityStatus(fresh);
  };

  const openAvailabilityDialog = (reason?: "busy" | "paused" | "unavailable" | "offline" | null) => {
    setAvailabilityBlockReason(reason ?? null);
    setAvailabilityOpen(true);
  };

  const reasonFromApiError = (e: Error): "busy" | "paused" | "unavailable" | "offline" | null => {
    const lower = e.message.toLowerCase();
    if (
      lower.includes("occupied") ||
      lower.includes("paused") ||
      lower.includes("mentor_occupied")
    ) {
      return "paused";
    }
    if (
      lower.includes("mentor_in_chat") ||
      lower.includes("currently in a chat") ||
      lower.includes("mentor_busy") ||
      lower.includes("busy")
    ) {
      return "busy";
    }
    if (lower.includes("mentor_unavailable") || lower.includes("unavailable")) {
      return "unavailable";
    }
    if (lower.includes("offline") || lower.includes("mentor_offline")) {
      return "offline";
    }
    return null;
  };

  const { data: upcomingWindows = [] } = useQuery({
    queryKey: ["mentor", mentorId, "availability-windows"],
    queryFn: () => listMentorAvailabilityWindows(mentorId!, 8),
    enabled: Boolean(mentorId),
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

  const welcomePromoQuery = useQuery({
    queryKey: ["welcome-promo"],
    queryFn: getWelcomePromo,
    enabled: role === "user" && Boolean(userAccessToken),
  });

  const joinWaitlistMut = useMutation({
    mutationFn: () => joinWaitlist(mentorId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor", mentorId, "waitlist"] });
      toast.success(md.waitlistJoined);
    },
    onError: (e: Error) => toast.error(humanizeApiError(e)),
  });

  const leaveWaitlistMut = useMutation({
    mutationFn: () => leaveWaitlist(mentorId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mentor", mentorId, "waitlist"] });
      toast.success(md.waitlistLeft);
    },
    onError: (e: Error) => toast.error(humanizeApiError(e)),
  });

  const handleBookingError = (e: Error) => {
    const reason = reasonFromApiError(e);
    if (reason) {
      void queryClient.invalidateQueries({ queryKey: ["mentor", mentorId, language] });
      openAvailabilityDialog(reason);
      return;
    }
    toast.error(humanizeApiError(e));
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
      toast.success(md.redirectingPayment);
      navigate(`/payment/${mentorId}?bookingId=${booking.id}`);
    },
    onError: handleBookingError,
  });

  const talkNowMut = useMutation({
    mutationFn: (minutes: number) =>
      startChatSession({
        mentor_id: mentorId!,
        minutes,
        promo_code: chatPromoCode.trim() || undefined,
        return_origin: typeof window !== "undefined" ? window.location.origin : null,
      }),
    onSuccess: (checkout) => {
      if (checkout.mollie_payment_id) {
        stashPendingMolliePaymentId(checkout.mollie_payment_id);
      }
      if (checkout.checkout_url) {
        toast.success(md.talkNowRedirecting);
        window.location.assign(checkout.checkout_url);
        return;
      }
      navigate(`/user/chat/${checkout.session.id}`);
    },
    onError: handleBookingError,
  });

  const userLoggedIn = role === "user" && Boolean(userAccessToken);
  const bookSessionDisabled = userLoggedIn && (mentorBusy || mentorPaused || mentorOffline || mentorUnavailable);
  const flexibleChatEnabled = Number(mentor?.chat_price_per_minute) > 0;
  const talkNowMinutes = Math.max(5, Number(mentor?.chat_min_purchase_minutes) || 5);
  const chatSessionAmount =
    flexibleChatEnabled && mentor ? Number(mentor.chat_price_per_minute) * talkNowMinutes : 0;

  useEffect(() => {
    const wp = welcomePromoQuery.data;
    if (!wp?.eligible || !wp.code || !mentor || !mentorId) return;
    if (talkNowMinutes !== wp.duration_minutes) return;
    if (welcomeChatPromoAppliedRef.current || chatPromoCode) return;

    welcomeChatPromoAppliedRef.current = true;
    const code = wp.code;
    setChatPromoInput(code);
    setValidatingChatPromo(true);
    setChatPromoError("");

    void validatePromoCode(code, chatSessionAmount, mentorId, talkNowMinutes, "chat")
      .then((res) => {
        if (res.is_valid) {
          setChatPromoCode(code);
          setChatPromoDiscount(res.discount_amount);
          setChatPromoFinal(res.final_amount);
          toast.success(p.welcomePromoApplied.replace("{code}", code));
        } else {
          welcomeChatPromoAppliedRef.current = false;
          setChatPromoError(res.message || p.promoInvalid);
        }
      })
      .catch((e) => {
        welcomeChatPromoAppliedRef.current = false;
        setChatPromoError(humanizeApiError(e, p.promoError));
      })
      .finally(() => setValidatingChatPromo(false));
  }, [
    welcomePromoQuery.data,
    mentor,
    mentorId,
    talkNowMinutes,
    chatSessionAmount,
    chatPromoCode,
    p.promoInvalid,
    p.promoError,
    p.welcomePromoApplied,
  ]);

  const handleApplyChatPromo = async () => {
    if (!chatPromoInput.trim() || !mentorId) return;
    setValidatingChatPromo(true);
    setChatPromoError("");
    try {
      const res = await validatePromoCode(
        chatPromoInput.trim(),
        chatSessionAmount,
        mentorId,
        talkNowMinutes,
        "chat",
      );
      if (res.is_valid) {
        setChatPromoCode(chatPromoInput.trim());
        setChatPromoDiscount(res.discount_amount);
        setChatPromoFinal(res.final_amount);
      } else {
        setChatPromoCode("");
        setChatPromoDiscount(0);
        setChatPromoFinal(null);
        setChatPromoError(res.message || p.promoInvalid);
      }
    } catch (e) {
      setChatPromoCode("");
      setChatPromoDiscount(0);
      setChatPromoFinal(null);
      setChatPromoError(humanizeApiError(e, p.promoError));
    } finally {
      setValidatingChatPromo(false);
    }
  };

  if (loadingMentor || !mentorId) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="animate-pulse font-serif text-xl italic text-muted-foreground">{md.profileLabel}…</p>
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
                <Link to="/mentors">{md.backToCoaches}</Link>
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
  const education = tagList(mentor, "education");
  const certifications = tagList(mentor, "certifications");
  const previousCompanies = tagList(mentor, "previous_companies");
  const profileSrc = mediaUrlFromApi(mentor.profile_image);
  const bannerSrc = mediaUrlFromApi(mentor.banner_image);

  const handleDurationSelect = async (minutes: (typeof SESSION_PACKAGES)[number]) => {
    if (role !== "user" || !userAccessToken) {
      toast.message(md.loginToBook);
      navigate("/login?role=user", { state: { from: `/mentors/${mentorId}` } });
      return;
    }
    const status = await refreshMentorAvailability();
    if (status !== "available") {
      openAvailabilityDialog(status === "busy" || status === "paused" || status === "unavailable" || status === "offline" ? status : "offline");
      return;
    }
    setSelectedDuration(minutes);
  };

  const handleLiveBook = async (communicationMode: LiveCommunicationMode) => {
    if (role !== "user" || !userAccessToken) {
      toast.message(md.loginToBook);
      navigate("/login?role=user", { state: { from: `/mentors/${mentorId}` } });
      return;
    }
    const status = await refreshMentorAvailability();
    if (status !== "available") {
      openAvailabilityDialog(status === "busy" || status === "paused" || status === "unavailable" || status === "offline" ? status : "offline");
      return;
    }
    liveBookMut.mutate({ durationMinutes: selectedDuration, communicationMode });
  };

  const handleTalkNow = async () => {
    if (role !== "user" || !userAccessToken) {
      toast.message(md.loginToTalk);
      navigate("/login?role=user", { state: { from: `/mentors/${mentorId}` } });
      return;
    }
    const status = await refreshMentorAvailability();
    if (status !== "available") {
      openAvailabilityDialog(status === "busy" || status === "paused" || status === "unavailable" || status === "offline" ? status : "offline");
      return;
    }
    const minPurchase = Math.max(1, Number(mentor?.chat_min_purchase_minutes) || 5);
    talkNowMut.mutate(Math.max(5, minPurchase));
  };

  const handleWaitlistToggle = () => {
    if (role !== "user" || !userAccessToken) {
      toast.message(md.loginToBook);
      navigate("/login?role=user", { state: { from: `/mentors/${mentorId}` } });
      return;
    }
    if (waitlistData?.position != null) {
      leaveWaitlistMut.mutate();
    } else {
      joinWaitlistMut.mutate();
    }
  };

  const onWaitlist = waitlistData?.position != null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (window.history.length > 1) navigate(-1);
            else navigate("/mentors");
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          {md.backToCoaches}
        </Button>
        <Card className="overflow-hidden border-border/60">
          <div className="relative h-36 w-full bg-gradient-to-br from-primary/80 via-primary to-accent sm:h-48 md:h-56">
            {bannerSrc ? (
              <img
                src={bannerSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
          </div>

          <CardHeader className="relative space-y-4 px-4 pt-0 sm:px-6">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                {profileSrc || bannerSrc ? (
                  <img
                    src={profileSrc ?? bannerSrc ?? ""}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-2xl border-4 border-card object-cover object-[center_28%] shadow-md sm:h-28 sm:w-28"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-muted font-serif text-2xl text-muted-foreground sm:h-28 sm:w-28">
                    {mentor.full_name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 space-y-1 pb-1">
                  <p className="text-xs uppercase tracking-widest text-accent sm:text-sm">{md.profileLabel}</p>
                  <div className="flex min-w-0 items-start gap-2">
                    <CardTitle className="break-words font-serif text-2xl leading-tight sm:text-4xl">
                      {mentor.full_name}
                    </CardTitle>
                    <FavoriteButton mentorId={mentor.id} className="mt-1 shrink-0" />
                  </div>
                  {mentor.headline ? (
                    <p className="text-sm text-muted-foreground sm:text-base">{mentor.headline}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                {availability === "available" ? (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                      <PresenceIndicator status="online" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {md.onlineBookNow}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{md.onlineHint}</p>
                    {unavailabilityLine ? (
                      <p className="text-[10px] text-muted-foreground">{unavailabilityLine}</p>
                    ) : null}
                  </div>
                ) : availability === "paused" ? (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <div className="flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 dark:border-orange-900/50 dark:bg-orange-950/30">
                      <PresenceIndicator status="occupied" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                        {md.paused}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{md.pausedHint}</p>
                    {unavailabilityLine ? (
                      <p className="text-[10px] text-muted-foreground">{unavailabilityLine}</p>
                    ) : null}
                  </div>
                ) : availability === "busy" ? (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <div className="flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 dark:border-rose-900/50 dark:bg-rose-950/30">
                      <PresenceIndicator status="busy" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        {md.inSession}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{md.inSessionHint}</p>
                    {unavailabilityLine ? (
                      <p className="text-[10px] text-muted-foreground">{unavailabilityLine}</p>
                    ) : null}
                  </div>
                ) : availability === "unavailable" ? (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 dark:border-amber-900/50 dark:bg-amber-950/30">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        {u.badge}
                      </span>
                    </div>
                    {unavailabilityLine ? (
                      <p className="text-[10px] text-muted-foreground">{unavailabilityLine}</p>
                    ) : null}
                  </div>
                ) : mentor.last_seen_at ? (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <div className="rounded border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {md.lastSeen}{" "}
                      {isSameCalendarDayLocal(mentor.last_seen_at, new Date(), effectiveTimeZone)
                        ? formatTimeLocal(mentor.last_seen_at, undefined, effectiveTimeZone)
                        : formatDateLocal(mentor.last_seen_at, { month: "short", day: "numeric" }, effectiveTimeZone)}
                    </div>
                    {unavailabilityLine ? (
                      <p className="text-[10px] text-muted-foreground">{unavailabilityLine}</p>
                    ) : null}
                  </div>
                ) : mentorOffline ? (
                  <div className="flex flex-col items-start gap-1 sm:items-end">
                    <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1">
                      <PresenceIndicator status="offline" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {md.offline}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{md.offlineHint}</p>
                    {unavailabilityLine ? (
                      <p className="text-[10px] text-muted-foreground">{unavailabilityLine}</p>
                    ) : null}
                  </div>
                ) : unavailabilityLine ? (
                  <p className="text-[10px] text-muted-foreground">{unavailabilityLine}</p>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 px-4 pb-6 sm:px-6">
            {mentor.bio ? (
              <section>
                <p className="mb-2 text-sm uppercase tracking-widest text-accent">{md.about}</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground sm:text-base">{mentor.bio}</p>
              </section>
            ) : null}

            {upcomingWindows.length > 0 ? (
              <section className="rounded-xl border border-border/70 p-4">
                <p className="mb-1 text-sm uppercase tracking-widest text-accent">{md.platformAvailability}</p>
                <p className="mb-3 text-xs text-muted-foreground">{md.platformAvailabilityHint}</p>
                <ul className="space-y-2">
                  {upcomingWindows.map((w) => (
                    <li
                      key={w.id}
                      className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {formatDateLocal(
                          w.start_at_utc,
                          { weekday: "short", month: "short", day: "numeric", year: "numeric" },
                          effectiveTimeZone,
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatTimeLocal(w.start_at_utc, undefined, effectiveTimeZone)}
                        {" – "}
                        {formatTimeLocal(w.end_at_utc, undefined, effectiveTimeZone)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 p-4">
                <p className="mb-2 text-sm uppercase tracking-widest text-accent">{md.details}</p>
                <p className="text-sm text-muted-foreground">
                  {md.experience}: {mentor.years_of_experience} {md.years}
                </p>
                <p className="text-sm text-muted-foreground">
                  {md.rating}: {mentor.average_rating} · {md.reviews}: {mentor.total_reviews}
                </p>
                {mentor.current_company ? (
                  <p className="text-sm text-muted-foreground">
                    {md.company}: {mentor.current_company}
                  </p>
                ) : null}
                {mentor.country_code ? (
                  <p className="text-sm text-muted-foreground">{mentor.country_code}</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <p className="mb-2 text-sm uppercase tracking-widest text-accent">{md.languages}</p>
                <div className="flex flex-wrap gap-2">
                  {langs.length > 0 ? (
                    langs.map((language) => (
                      <Badge key={language} variant="secondary" className="max-w-full whitespace-normal break-words">
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
              <div className="grid gap-4 sm:grid-cols-2">
                <ChipBlock title={md.expertise} items={expertise} />
                <ChipBlock title={md.skills} items={skills} />
              </div>
            )}

            {(education.length > 0 || certifications.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ChipBlock title={md.education} items={education} />
                <ChipBlock title={md.certifications} items={certifications} />
              </div>
            )}

            {(sessionModes.length > 0 || tools.length > 0 || previousCompanies.length > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ChipBlock title={md.sessionModes} items={sessionModes} />
                <ChipBlock title={md.tools} items={tools} />
                <ChipBlock title={md.previousCompanies} items={previousCompanies} />
              </div>
            )}

            {mentor.badges && mentor.badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {mentor.badges.map((badge) => (
                  <Badge key={badge} variant="outline">
                    {badge}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
              <p className="mb-3 text-sm uppercase tracking-widest text-accent">{md.livePricing}</p>
              {pricing ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {SESSION_PACKAGES.map((mins) => {
                      const amount = sessionPackageEur(mentor, pricing, mins);
                      const isSelected = selectedDuration === mins;
                      const pricingInactive = !pricing.is_active;
                      const offlineOrBusy = !canBookLive;
                      const muted = pricingInactive || offlineOrBusy;
                      return (
                        <Button
                          key={mins}
                          type="button"
                          variant={isSelected && !muted ? "default" : "outline"}
                          className={
                            muted
                              ? "h-auto min-h-[4.75rem] flex-col gap-0.5 border-2 border-dashed border-border/80 bg-background/80 py-3 text-center font-normal text-muted-foreground opacity-80"
                              : isSelected
                                ? "gradient-cta text-white flex h-auto min-h-[4.75rem] flex-col gap-0.5 py-3 text-center font-normal shadow-md ring-2 ring-accent/40"
                                : "flex h-auto min-h-[4.75rem] flex-col gap-0.5 border-2 border-border/80 bg-background py-3 text-center font-normal hover:border-accent/50"
                          }
                          disabled={pricingInactive}
                          title={
                            pricingInactive
                              ? md.sessionCheckoutDisabled
                              : mentorOffline
                                ? md.offline
                                : mentorPaused
                                  ? md.paused
                                  : mentorBusy
                                    ? md.inSession
                                    : md.selectDurationSession.replace("{minutes}", String(mins))
                          }
                          onClick={() => handleDurationSelect(mins)}
                        >
                          <span className="text-sm font-semibold tracking-wide">{mins} {md.mins}</span>
                          <span
                            className={
                              muted ? "text-base font-semibold" : "text-base font-bold text-white"
                            }
                          >
                            {pricing.currency} {amount.toFixed(2)}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                  {!pricing.is_active ? (
                    <p className="mt-3 text-xs text-muted-foreground">{md.pricingInactive}</p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {md.pricingHelpBefore}
                      <strong className="text-foreground">{md.pricingHelpVideo}</strong>
                      {md.pricingHelpMid}
                      <strong className="text-foreground">{md.pricingHelpVoice}</strong>
                      {md.pricingHelpAfter}
                    </p>
                  )}
                  {pricing?.is_active && canBookLive ? (
                    <div className="mt-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                      <LiveSessionWindowPreview durationMinutes={selectedDuration} className="text-xs" />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{md.pricingUnavailable}</p>
              )}
              {Number(mentor.chat_price_per_minute) > 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {md.flexibleChat}:{" "}
                  <span className="font-medium text-foreground">
                    {mentor.chat_price_per_minute} {mentor.chat_currency}/min
                  </span>
                  {mentor.chat_min_purchase_minutes ? (
                    <span>
                      {" "}
                      · {md.minPurchase.replace("{minutes}", String(mentor.chat_min_purchase_minutes))}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {flexibleChatEnabled && userLoggedIn ? (
                <div className="mt-4 space-y-2 rounded-lg border border-border/60 bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">{md.talkNowPromoHint}</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      aria-label={p.promoLabel}
                      placeholder={p.promoLabel}
                      value={chatPromoInput}
                      onChange={(e) => setChatPromoInput(e.target.value)}
                      disabled={validatingChatPromo || talkNowMut.isPending}
                      className="sm:flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => void handleApplyChatPromo()}
                      disabled={validatingChatPromo || talkNowMut.isPending || !chatPromoInput.trim()}
                    >
                      {md.apply}
                    </Button>
                  </div>
                  {chatPromoError ? <p className="text-xs text-destructive">{chatPromoError}</p> : null}
                  {chatPromoCode && !chatPromoError ? (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {md.promoApplied}: -EUR {chatPromoDiscount.toFixed(2)}
                      {chatPromoFinal != null && chatPromoFinal <= 0.01 ? ` · ${md.freeTalkNowSession}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/mentors">{md.backToCoaches}</Link>
              </Button>
              {flexibleChatEnabled ? (
                <Button
                  type="button"
                  className="w-full gradient-cta text-white disabled:opacity-60 sm:w-auto"
                  disabled={talkNowMut.isPending || bookSessionDisabled}
                  title={md.talkNowHint}
                  onClick={handleTalkNow}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  {md.talkNow}
                </Button>
              ) : null}
              <Button
                type="button"
                className={`w-full gradient-cta text-white disabled:opacity-60 sm:w-auto ${bookSessionDisabled ? "opacity-80" : ""}`}
                disabled={liveBookMut.isPending || (!bookSessionDisabled && !pricing?.is_active)}
                title={
                  mentorUnavailable
                    ? u.badge
                    : mentorPaused
                      ? md.paused
                      : mentorOffline
                    ? md.offline
                    : mentorBusy
                      ? md.inSession
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
                className={`w-full disabled:opacity-60 sm:w-auto ${bookSessionDisabled ? "opacity-80" : ""}`}
                disabled={liveBookMut.isPending || (!bookSessionDisabled && !pricing?.is_active)}
                title={
                  mentorUnavailable
                    ? u.badge
                    : mentorPaused
                      ? md.paused
                      : mentorOffline
                    ? md.offline
                    : mentorBusy
                      ? md.inSession
                      : `Book ${selectedDuration}-minute voice call`
                }
                onClick={() => handleLiveBook("call")}
              >
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
              {mentorBusy ? (
                onWaitlist ? (
                  <>
                    <Badge variant="secondary" className="h-9 items-center px-3 text-sm font-normal">
                      {md.waitlistPosition.replace("{position}", String(waitlistData?.position ?? ""))}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={leaveWaitlistMut.isPending}
                      onClick={() => leaveWaitlistMut.mutate()}
                    >
                      {md.leaveWaitlist}
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={joinWaitlistMut.isPending}
                    onClick={handleWaitlistToggle}
                  >
                    {md.joinWaitlist}
                  </Button>
                )
              ) : null}
              {bookSessionDisabled ? (
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => openAvailabilityDialog()}>
                  {md.seeWhenAvailable}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={availabilityOpen}
          onOpenChange={(open) => {
            setAvailabilityOpen(open);
            if (!open) setAvailabilityBlockReason(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{md.notAvailableTitle}</DialogTitle>
              <DialogDescription>
                {dialogBusy
                  ? md.notAvailableBusyBody
                  : dialogPaused
                    ? md.notAvailablePausedBody
                    : dialogUnavailable
                    ? md.notAvailableUnavailableBody
                    : md.notAvailableOfflineBody}{" "}
                {md.bookWhenOnline}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {upcomingWindows.length > 0 ? (
                <>
                  <p className="text-sm font-medium text-foreground">{md.nextAvailable}</p>
                  <ul className="space-y-2">
                    {upcomingWindows.map((w) => (
                      <li
                        key={w.id}
                        className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">
                          {formatDateLocal(
                            w.start_at_utc,
                            { weekday: "short", month: "short", day: "numeric", year: "numeric" },
                            effectiveTimeZone,
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {formatTimeLocal(w.start_at_utc, undefined, effectiveTimeZone)}
                          {" – "}
                          {formatTimeLocal(w.end_at_utc, undefined, effectiveTimeZone)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{md.noUpcomingWindows}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setAvailabilityOpen(false)}>
                {md.dismiss}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SimilarCoaches mentorId={mentor.id} />
      </main>
    </div>
  );
};

export default MentorDetailPage;

function SimilarCoaches({ mentorId }: { mentorId: string }) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const md = t.app.mentorDetail;
  const { data: mentors = [], isLoading } = useQuery({
    queryKey: ["mentors", "similar", mentorId, language],
    queryFn: () => getSimilarMentors(mentorId),
    enabled: Boolean(mentorId),
  });

  if (isLoading || mentors.length === 0) return null;

  return (
    <div className="mt-10 sm:mt-12">
      <h3 className="mb-6 font-serif text-xl sm:text-2xl">{md.similarCoaches}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mentors.map((m) => {
          const thumb = mediaUrlFromApi(m.profile_image) ?? mediaUrlFromApi(m.banner_image);
          return (
          <Card key={m.id} className="cursor-pointer transition-transform hover:-translate-y-1" onClick={() => navigate(`/mentors/${m.id}`)}>
            <CardHeader className="p-4">
              <div className="flex items-start gap-3">
                {thumb ? (
                  <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover object-[center_28%]" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="break-words text-lg leading-tight">{m.full_name}</CardTitle>
                    <span
                      className={
                        getMentorAvailabilityStatus(m) === "available"
                          ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                          : getMentorAvailabilityStatus(m) === "busy"
                            ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500"
                            : getMentorAvailabilityStatus(m) === "paused"
                              ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500"
                              : getMentorAvailabilityStatus(m) === "unavailable"
                                ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500"
                                : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400"
                      }
                    />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.headline}</p>
                </div>
              </div>
            </CardHeader>
          </Card>
          );
        })}
      </div>
    </div>
  );
}
