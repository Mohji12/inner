import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createBookingReview,
  createPaymentIntent,
  listUserBookings,
  patchBookingAsUser,
  getBookingCalendarUrl,
} from "@/api/bookings";
import { saveUserBookingInvoicePdf } from "@/api/invoices";
import { getChatSession, listChatSessions } from "@/api/chat";
import { getCheckoutCurrencies, syncMolliePaymentAfterCheckout } from "@/api/payments";
import { useAuth } from "@/auth/AuthContext";
import { getMentor, getPlatformPricing } from "@/api/mentors";
import type { Booking, MentorDetail, ChatInboxSession } from "@/api/types";
import { slotPriceForDuration } from "@/api/types";
import { CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckoutCurrencySelect } from "@/components/CheckoutCurrencySelect";
import { SuccessBurst } from "@/components/ui/SuccessBurst";
import { guessCheckoutCurrencyFromLocale } from "@/lib/checkoutCurrencyGuess";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { chatSessionCardCaption } from "@/lib/chatSessionCardCaption";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { useLanguage } from "@/i18n/LanguageContext";
import { SessionBookingDetails } from "@/components/SessionBookingDetails";
import {
  clearPendingMolliePaymentId,
  peekPendingMolliePaymentId,
  stashPendingMolliePaymentId,
} from "@/lib/molliePendingPayment";
import {
  canDownloadBookingInvoice,
  canOpenBookingChat,
  chatSessionById,
  isBookingSessionEnded,
  meetingLinkSessionId,
  sortBookingsForDisplay,
  standaloneChatSessions,
} from "@/lib/bookingChatLinks";
import { toast } from "sonner";

const UserAppointmentsPage = () => {
  const { t } = useLanguage();
  const ap = t.app.appointments;
  const statusLabel = (key: string) =>
    ap.statusLabels[key as keyof typeof ap.statusLabels] ?? key.replaceAll("_", " ");
  const { role, userAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  /** User asked for browser-local viewing when picking / reading appointment times */
  const displayTimeZone = useEffectiveTimeZone();
  const highlightedSessionId = (searchParams.get("sessionId") || "").trim();
  const highlightedBookingId = (searchParams.get("bookingId") || "").trim();
  const [isConfirmingSession, setIsConfirmingSession] = useState(false);
  const bookingToastShownRef = useRef(false);
  const [paymentSuccessVisible, setPaymentSuccessVisible] = useState(false);
  const sessionReadyToastShownRef = useRef(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", "me"],
    queryFn: listUserBookings,
  });

  const mentorQueries = useQuery({
    queryKey: ["mentors-for-bookings", bookings.map((b) => b.mentor_id).join(",")],
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

  const pricingQuery = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: getPlatformPricing,
  });

  const currenciesQuery = useQuery({
    queryKey: ["checkout-currencies"],
    queryFn: getCheckoutCurrencies,
  });
  const [checkoutCurrency, setCheckoutCurrency] = useState("EUR");
  const chatInboxQuery = useQuery({
    queryKey: ["chat", "sessions", "appointments"],
    queryFn: listChatSessions,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const linkedSessionIds = useMemo(
    () =>
      [
        ...new Set(
          bookings
            .filter((b) => b.payment_status === "paid" && b.meeting_link)
            .map((b) => meetingLinkSessionId(b.meeting_link))
            .filter((id): id is string => Boolean(id)),
        ),
      ],
    [bookings],
  );

  const linkedSessionQueries = useQueries({
    queries: linkedSessionIds.map((sessionId) => ({
      queryKey: ["chat", "session", "booking-link", sessionId],
      queryFn: () => getChatSession(sessionId),
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    })),
  });

  useEffect(() => {
    const list = currenciesQuery.data;
    if (!list?.length) return;
    setCheckoutCurrency((prev) =>
      list.map((c) => c.toUpperCase()).includes(prev) ? prev : guessCheckoutCurrencyFromLocale(navigator.language, list),
    );
  }, [currenciesQuery.data]);

  useEffect(() => {
    if (role !== "user" || !userAccessToken) return;
    const pending = peekPendingMolliePaymentId();
    if (!pending) return;
    let cancelled = false;
    void (async () => {
      try {
        await syncMolliePaymentAfterCheckout(pending);
        if (cancelled) return;
        clearPendingMolliePaymentId();
        void queryClient.invalidateQueries({ queryKey: ["bookings", "me"] });
        void queryClient.invalidateQueries({ queryKey: ["chat", "sessions", "appointments"] });
        void queryClient.invalidateQueries({ queryKey: ["chat", "inbox"] });
      } catch {
        /* webhook may arrive later or user revisits */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, userAccessToken, queryClient]);

  const payMut = useMutation({
    mutationFn: ({
      bookingId,
      checkoutCurrency: ccy,
    }: {
      bookingId: string;
      checkoutCurrency: string;
    }) => createPaymentIntent(bookingId, { checkout_currency: ccy }),
    onSuccess: (out) => {
      stashPendingMolliePaymentId(out.payment_id);
      window.location.href = out.checkout_url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => patchBookingAsUser(id, { status: "cancelled" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings", "me"] });
      toast.success("Booking cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMut = useMutation({
    mutationFn: () =>
      reviewBooking
        ? createBookingReview(reviewBooking.id, { rating, review_text: reviewText || null })
        : Promise.reject(new Error("No booking")),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings", "me"] });
      setReviewOpen(false);
      setReviewBooking(null);
      toast.success("Thanks for your review");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDownloadInvoice = async (bookingId: string) => {
    setDownloadingInvoiceId(bookingId);
    try {
      await saveUserBookingInvoicePdf(bookingId);
      toast.success("Invoice downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download invoice");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const mentorMap = mentorQueries.data ?? new Map<string, MentorDetail>();
  const chatSessions = chatInboxQuery.data?.sessions ?? [];
  const chatSessionMap = useMemo(() => {
    const map = chatSessionById(chatSessions);
    linkedSessionIds.forEach((sessionId, index) => {
      const session = linkedSessionQueries[index]?.data;
      if (!session) return;
      const existing = map.get(sessionId);
      if (existing) {
        map.set(sessionId, {
          ...existing,
          status: session.status,
          remaining_seconds: session.remaining_seconds,
          ends_at: session.ends_at,
        });
      } else {
        map.set(sessionId, {
          id: sessionId,
          status: session.status,
          remaining_seconds: session.remaining_seconds,
        } as ChatInboxSession);
      }
    });
    return map;
  }, [chatSessions, linkedSessionIds, linkedSessionQueries]);
  const instantChatSessions = useMemo(
    () => standaloneChatSessions(chatSessions, bookings),
    [chatSessions, bookings],
  );
  const sortedBookings = useMemo(() => sortBookingsForDisplay(bookings), [bookings]);
  const highlightedSession = useMemo(
    () => chatSessions.find((s) => s.id === highlightedSessionId) ?? null,
    [chatSessions, highlightedSessionId],
  );

  useEffect(() => {
    if (!highlightedBookingId) return;
    const hit = bookings.some((b) => b.id === highlightedBookingId);
    if (hit && !bookingToastShownRef.current) {
      bookingToastShownRef.current = true;
      setPaymentSuccessVisible(true);
      const hideTimer = window.setTimeout(() => setPaymentSuccessVisible(false), 8000);
      return () => window.clearTimeout(hideTimer);
    }
    const pollTimer = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["bookings", "me"] });
    }, 1500);
    return () => window.clearTimeout(pollTimer);
  }, [bookings, highlightedBookingId, queryClient]);

  useEffect(() => {
    if (!highlightedSessionId) return;
    if (highlightedSession?.status === "active") {
      setIsConfirmingSession(false);
      return;
    }
    let disposed = false;
    setIsConfirmingSession(true);
    const startedAt = Date.now();
    const maxWaitMs = 25_000;
    const poll = async () => {
      if (disposed) return;
      try {
        const session = await getChatSession(highlightedSessionId);
        if (disposed) return;
        if (session.status === "active") {
          setIsConfirmingSession(false);
          void queryClient.invalidateQueries({ queryKey: ["chat", "sessions", "appointments"] });
          if (!sessionReadyToastShownRef.current) {
            sessionReadyToastShownRef.current = true;
            toast.success("Your live session is ready. Join now.");
          }
          return;
        }
      } catch {
        // Ignore transient lag after redirect/webhook.
      }
      if (Date.now() - startedAt >= maxWaitMs) {
        setIsConfirmingSession(false);
        return;
      }
      window.setTimeout(() => {
        void poll();
      }, 1500);
    };
    void poll();
    return () => {
      disposed = true;
    };
  }, [highlightedSessionId, highlightedSession?.status, queryClient]);

  if (isLoading) {
    return <p className="text-muted-foreground">Loading appointments…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">Appointments</p>
          <h1 className="font-serif text-3xl">My bookings</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Session times use your profile timezone when set, otherwise your browser timezone ({displayTimeZone}).
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Each paid booking appears once below. Instant chat (Talk now) history is listed separately when applicable.
          </p>
        </div>
        {currenciesQuery.data?.length ? (
          <div className="w-full max-w-xs">
            <CheckoutCurrencySelect
              id="appointments-checkout-ccy"
              label="Payment currency (Mollie)"
              value={checkoutCurrency}
              onChange={setCheckoutCurrency}
              currencies={currenciesQuery.data}
              disabled={payMut.isPending}
            />
          </div>
        ) : null}
      </div>

      {paymentSuccessVisible ? (
        <Card className="border-primary/40 bg-primary/5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <CardContent className="flex flex-col items-center gap-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <SuccessBurst
              size="sm"
              label="Payment successful"
              description="Your booking is below — use Start Session when you're ready to join."
              className="sm:items-start sm:text-left"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => setPaymentSuccessVisible(false)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {highlightedSessionId && isConfirmingSession ? (
        <Card className="border-border/60">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Confirming payment and activating your session. This can take a few seconds after Mollie redirect.
          </CardContent>
        </Card>
      ) : null}

      {instantChatSessions.length > 0 ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-accent">Instant chat</p>
            <h2 className="font-serif text-2xl">Talk now sessions</h2>
          </div>
          {instantChatSessions.map((s: ChatInboxSession) => {
            const canJoin = s.status === "active";
            const isHighlighted = Boolean(highlightedSessionId) && s.id === highlightedSessionId;
            const cap = chatSessionCardCaption(
              {
                ends_at: s.ends_at,
                remaining_seconds: s.remaining_seconds,
                status: s.status,
                role: "user",
              },
              displayTimeZone,
            );
            return (
              <Card key={s.id} className={isHighlighted ? "border-accent/60 ring-1 ring-accent/50" : "border-border/60"}>
                <CardContent className="space-y-3 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{s.partner_name || "Coach"}</p>
                      <p className="text-sm text-muted-foreground">{cap.primaryLine}</p>
                      {cap.secondaryLine ? (
                        <p className="mt-1 text-xs text-muted-foreground">{cap.secondaryLine}</p>
                      ) : null}
                      {s.booking ? <SessionBookingDetails booking={s.booking} variant="compact" className="mt-2" /> : null}
                      {s.last_message_body ? (
                        <p className="mt-1 text-xs text-muted-foreground">{s.last_message_body}</p>
                      ) : null}
                    </div>
                    <Badge variant={canJoin ? "default" : "secondary"}>{s.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canJoin ? (
                      <Button size="sm" className="gradient-cta text-white" asChild>
                        <Link to={`/user/chat/${s.id}`}>Join session</Link>
                      </Button>
                    ) : null}
                    {s.status === "ended" ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/user/chat/${s.id}`}>View history</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/user/chat/${s.id}`}>
                          {s.status === "active" ? "Open chatroom" : "Open chatroom (paused)"}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      <div className="space-y-4">
        {bookings.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">{ap.emptyTitle}</CardTitle>
              <CardDescription>{ap.emptyDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="gradient-cta text-white">
                <Link to="/mentors">Find coaches</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
        {sortedBookings.map((b) => {
          const mentor = mentorMap.get(b.mentor_id);
          const amount = pricingQuery.data ? slotPriceForDuration(pricingQuery.data, b.duration) : null;
          const startUtc = new Date(b.start_at_utc);
          const endUtc = new Date(b.end_at_utc);
          const now = new Date();
          const linkedChat = (() => {
            const sessionId = meetingLinkSessionId(b.meeting_link);
            return sessionId ? chatSessionMap.get(sessionId) : undefined;
          })();
          const canStartSession = canOpenBookingChat(b, linkedChat, now);
          const sessionEnded = isBookingSessionEnded(b, linkedChat, now);
          const canDownloadInvoice = canDownloadBookingInvoice(b, linkedChat, now);
          const isLiveSession = canStartSession;
          const isHighlightedBooking = Boolean(highlightedBookingId) && b.id === highlightedBookingId;
          return (
            <Card
              key={b.id}
              className={
                isHighlightedBooking || isLiveSession
                  ? "border-accent/60 ring-1 ring-accent/50"
                  : "border-border/60"
              }
            >
              <CardContent className="space-y-3 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{mentor?.full_name ?? "Coach"}</p>
                      {isLiveSession ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Current session</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateLocal(startUtc, { year: "numeric", month: "2-digit", day: "2-digit" }, displayTimeZone)} ·{" "}
                      {formatTimeLocal(startUtc, undefined, displayTimeZone)}–{formatTimeLocal(endUtc, undefined, displayTimeZone)} ·{" "}
                      {b.duration} min
                    </p>
                    {b.session_topic ? (
                      <p className="mt-2 text-sm text-muted-foreground">{b.session_topic}</p>
                    ) : null}
                    {b.goals_expected ? (
                      <p className="mt-1 text-sm text-muted-foreground">Goals: {b.goals_expected}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0 text-xs text-muted-foreground">
                      {b.experience_level ? <span>Level: {b.experience_level}</span> : null}
                      {b.urgency_level ? <span>Urgency: {b.urgency_level}</span> : null}
                      {b.communication_mode ? <span>Mode: {b.communication_mode}</span> : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{statusLabel(b.status)}</Badge>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ap.paymentLabel}: {statusLabel(b.payment_status)}
                    </p>
                    {amount != null ? <p className="text-sm font-medium">EUR {amount.toFixed(2)}</p> : null}
                  </div>
                </div>

                {linkedChat && isLiveSession ? (
                  <p className="text-xs text-muted-foreground">
                    Live chat: {linkedChat.status === "active" ? "ready to join" : linkedChat.status}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {canStartSession ? (
                    <Button size="sm" className="gradient-cta text-white" asChild>
                      <Link to={b.meeting_link!}>
                        {linkedChat?.status === "active" ? "Start Session" : "Open chatroom"}
                      </Link>
                    </Button>
                  ) : null}
                  {b.status === "confirmed" && b.payment_status === "paid" && !canStartSession && !sessionEnded ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={getBookingCalendarUrl(b.id)} download>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Add to Calendar
                      </a>
                    </Button>
                  ) : null}
                  {canDownloadInvoice ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingInvoiceId === b.id}
                      onClick={() => void handleDownloadInvoice(b.id)}
                    >
                      Download Invoice
                    </Button>
                  ) : null}
                  {b.status === "pending_payment" && b.payment_status === "unpaid" ? (
                    <Button
                      size="sm"
                      className="gradient-cta text-white"
                      onClick={() => payMut.mutate({ bookingId: b.id, checkoutCurrency })}
                    >
                      Pay with Mollie
                    </Button>
                  ) : null}
                  {b.status === "pending_payment" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelMut.mutate(b.id)}
                      disabled={cancelMut.isPending}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  {b.status === "completed" && b.payment_status === "paid" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewBooking(b);
                        setReviewOpen(true);
                      }}
                    >
                      Leave review
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate your session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Rating (1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Comments</Label>
              <Textarea rows={3} value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Close
            </Button>
            <Button onClick={() => reviewMut.mutate()} disabled={reviewMut.isPending}>
              Submit review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserAppointmentsPage;
