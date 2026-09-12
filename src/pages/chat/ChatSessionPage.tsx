import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { endChatSession, getChatSession, joinChatSession, listChatMessages } from "@/api/chat";
import { syncMolliePaymentAfterCheckout } from "@/api/payments";
import { getMeeting } from "@/api/meetings";
import type { MeetingCommunicationMode } from "@/api/meetings";
import type { ChatSession } from "@/api/types";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CoachNoShowDialog, COACH_NO_SHOW_ALERT_MS } from "@/components/chat/CoachNoShowDialog";
import { SessionExtendDialog } from "@/components/chat/SessionExtendDialog";
import { SessionExpiryWarningDialog } from "@/components/chat/SessionExpiryWarningDialog";
import { LiveClock } from "@/components/LiveClock";
import { SessionBookingDetails } from "@/components/SessionBookingDetails";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { MeetingPanel } from "@/components/meeting/MeetingPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clearPendingMolliePaymentId,
  peekPendingMolliePaymentId,
} from "@/lib/molliePendingPayment";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { sessionNeedsInitialPayment, sessionTimeExpired, sessionJoinWindowExpired } from "@/lib/chatSessionTiming";
import { useLanguage } from "@/i18n/LanguageContext";
import type { AppCopy } from "@/i18n/appBase";

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function resolveCommunicationMode(
  searchParams: URLSearchParams,
  meetingMode: MeetingCommunicationMode | null | undefined,
  bookingMode: string | null | undefined,
): MeetingCommunicationMode | null {
  const fromUrl = searchParams.get("mode");
  if (fromUrl === "call" || fromUrl === "video") return fromUrl;
  if (meetingMode === "call" || meetingMode === "video") return meetingMode;
  if (bookingMode === "call" || bookingMode === "video") return bookingMode;
  return null;
}

function waitingLabel(
  waitingFor: ChatSession["waiting_for"],
  role: string | null,
  c: AppCopy["chatSession"],
): string {
  if (!waitingFor) return c.waitingToStart;
  if (waitingFor === "mentor") return role === "mentor" ? c.userWaitingForYou : c.waitingForCoach;
  if (waitingFor === "user") return role === "user" ? c.coachWaitingForYou : c.waitingForUser;
  return c.waitingForBoth;
}

const ChatSessionPage = () => {
  const { sessionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t } = useLanguage();
  const c = t.app.chatSession;
  const queryClient = useQueryClient();

  const [extendOpen, setExtendOpen] = useState(false);
  const [expiryWarningOpen, setExpiryWarningOpen] = useState(false);
  const [warningUrgency, setWarningUrgency] = useState<"initial" | "final">("initial");
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const [coachNoShowOpen, setCoachNoShowOpen] = useState(false);
  const [coachWaitAlertReady, setCoachWaitAlertReady] = useState(false);
  const [endingForNewCoach, setEndingForNewCoach] = useState(false);
  const firstWarningAt = useRef<number | null>(null);
  const secondWarningShown = useRef(false);
  const mollieSyncedRef = useRef(false);
  const coachWaitStartedAt = useRef<number | null>(null);
  const coachNoShowAlertShown = useRef(false);
  const endingForNewCoachRef = useRef(false);

  const sid = sessionId ?? "";

  const sessionQuery = useQuery({
    queryKey: ["chat", "session", sid],
    queryFn: () => getChatSession(sid),
    enabled: Boolean(sid),
    staleTime: 2_000,
    refetchInterval: (q) => {
      const d = q.state.data as ChatSession | undefined;
      if (!d) return 2_000;
      // Keep polling after end so a paid "Continue chat" can refresh the UI.
      if (d.status === "ended") return 12_000;
      if (!d.timer_started && d.waiting_for) return 4_000;
      return 8_000;
    },
  });

  // Prefetch recent messages in parallel with session so the thread is warm when ChatPanel mounts.
  useQuery({
    queryKey: ["chat", "messages", sid],
    queryFn: () => listChatMessages(sid, { limit: 50 }),
    enabled: Boolean(sid),
    staleTime: 0,
  });

  useEffect(() => {
    if (!sid) return;
    void joinChatSession(sid)
      .then((joined) => {
        queryClient.setQueryData(["chat", "session", sid], joined);
      })
      .catch(() => {
        // Session fetch will surface auth/errors.
      });
  }, [sid, queryClient]);

  useEffect(() => {
    if (role !== "user" || !sid || mollieSyncedRef.current) return;
    const pending = peekPendingMolliePaymentId();
    const extendedFlag = searchParams.get("extended") === "1";
    const paidFlag = searchParams.get("paid") === "1";
    const checkoutReturn = searchParams.get("checkout") === "return";
    if (!pending && !extendedFlag && !paidFlag && !checkoutReturn) return;
    mollieSyncedRef.current = true;

    let cancelled = false;
    const settled = (status: string) =>
      ["paid", "failed", "canceled", "cancelled", "expired"].includes(status);

    void (async () => {
      try {
        let paymentStatus: string | null = null;
        if (pending) {
          // Poll Mollie sync briefly so paid status applies without waiting on webhook lag.
          let out = await syncMolliePaymentAfterCheckout(pending);
          for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
            paymentStatus = String(out.status || "").toLowerCase();
            if (settled(paymentStatus)) break;
            await new Promise((r) => window.setTimeout(r, 700));
            if (cancelled) return;
            out = await syncMolliePaymentAfterCheckout(pending);
          }
          if (cancelled) return;
          clearPendingMolliePaymentId();
          paymentStatus = String(out.status || "").toLowerCase();
          if (paymentStatus === "paid") {
            toast.success(extendedFlag ? c.toastTimeAdded : c.toastPaymentConfirmed);
          } else if (["failed", "canceled", "cancelled", "expired"].includes(paymentStatus)) {
            toast.message(c.toastPaymentNotCompleted);
          } else toast.info(c.toastPaymentProcessing);
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["chat", "session", sid] }),
          queryClient.invalidateQueries({ queryKey: ["meeting", "session", sid] }),
          queryClient.invalidateQueries({ queryKey: ["chat", "sessions", "appointments"] }),
          queryClient.invalidateQueries({ queryKey: ["chat", "inbox"] }),
        ]);
        const refreshed = await queryClient.fetchQuery({
          queryKey: ["chat", "session", sid],
          queryFn: () => getChatSession(sid),
        });
        if (
          !cancelled &&
          sessionNeedsInitialPayment(refreshed) &&
          (checkoutReturn ||
            paidFlag ||
            (paymentStatus && ["failed", "canceled", "cancelled", "expired", "open"].includes(paymentStatus)))
        ) {
          toast.message(c.toastPayBelow);
          setExtendOpen(true);
        }
      } catch {
        if (!cancelled) toast.info(c.toastPaymentProcessing);
      } finally {
        if (!cancelled && (extendedFlag || paidFlag || checkoutReturn)) {
          const next = new URLSearchParams(searchParams);
          next.delete("extended");
          next.delete("paid");
          next.delete("checkout");
          setSearchParams(next, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, sid, searchParams, setSearchParams, queryClient, c]);

  const meetingQuery = useQuery({
    queryKey: ["meeting", "session", sid],
    queryFn: () => getMeeting(sid),
    enabled: Boolean(sid),
    staleTime: 3_000,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 2_000;
      if (d.status === "ended") return false;
      return 10_000;
    },
  });

  const session = sessionQuery.data;
  const meeting = meetingQuery.data;
  const sessionError = sessionQuery.error;

  const endMut = useMutation({
    mutationFn: () => endChatSession(sid),
    onSuccess: () => {
      const coachMissed = role === "user" && (!session?.timer_started || session?.waiting_for === "mentor");
      if (coachMissed) {
        toast.success(c.toastRefunded);
      } else {
        toast.message(c.toastChatEnded);
      }
      void queryClient.invalidateQueries({ queryKey: ["chat", "session", sid] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "session", "booking-link", sid] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions", "appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["meeting", "session", sid] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "mentor-active"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["user-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["welcome-promo"] });
      setCoachNoShowOpen(false);
      if (endingForNewCoachRef.current) {
        endingForNewCoachRef.current = false;
        setEndingForNewCoach(false);
        navigate("/mentors");
      }
    },
    onError: (e: Error) => {
      endingForNewCoachRef.current = false;
      setEndingForNewCoach(false);
      toast.error(e.message);
    },
  });

  useEffect(() => {
    if (session?.remaining_seconds != null) {
      setLocalRemaining(session.remaining_seconds);
    }
  }, [session?.remaining_seconds]);

  const waitingForCoachOnly =
    role === "user" &&
    Boolean(session && session.status !== "ended" && !session.timer_started && session.waiting_for === "mentor");

  useEffect(() => {
    if (session?.timer_started || session?.status === "ended") {
      coachWaitStartedAt.current = null;
      coachNoShowAlertShown.current = false;
      setCoachWaitAlertReady(false);
      setCoachNoShowOpen(false);
      return;
    }
    if (!waitingForCoachOnly) {
      setCoachNoShowOpen(false);
      return;
    }
    if (coachWaitStartedAt.current == null) {
      coachWaitStartedAt.current = Date.now();
    }
    const tick = () => {
      const started = coachWaitStartedAt.current;
      if (started == null) return;
      if (Date.now() - started < COACH_NO_SHOW_ALERT_MS) return;
      setCoachWaitAlertReady(true);
      if (!coachNoShowAlertShown.current) {
        coachNoShowAlertShown.current = true;
        setCoachNoShowOpen(true);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [waitingForCoachOnly, session?.timer_started, session?.status]);

  useEffect(() => {
    if (!session?.timer_started || session.status === "ended" || session.timer_paused_for_payment) return;
    const interval = window.setInterval(() => {
      setLocalRemaining((prev) => (prev != null ? Math.max(0, prev - 1) : prev));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session?.timer_started, session?.status, session?.timer_paused_for_payment]);

  useEffect(() => {
    if (role !== "user" || !session?.timer_started || localRemaining == null) return;

    if (localRemaining > 60) {
      firstWarningAt.current = null;
      secondWarningShown.current = false;
      return;
    }

    if (localRemaining <= 0) {
      setExpiryWarningOpen(false);
      return;
    }

    if (firstWarningAt.current === null) {
      firstWarningAt.current = Date.now();
      setWarningUrgency("initial");
      setExpiryWarningOpen(true);
    }
  }, [localRemaining, role, session?.timer_started]);

  useEffect(() => {
    if (role !== "user" || !session?.timer_started) return;

    const interval = window.setInterval(() => {
      if (firstWarningAt.current === null || secondWarningShown.current) return;
      if ((Date.now() - firstWarningAt.current) / 1000 >= 15) {
        secondWarningShown.current = true;
        setWarningUrgency("final");
        setExpiryWarningOpen(true);
        toast.warning(c.toastExpiryWarning, {
          duration: 10_000,
        });
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [role, session?.timer_started, c.toastExpiryWarning]);

  useEffect(() => {
    if (localRemaining === 0) {
      setExpiryWarningOpen(false);
    }
  }, [localRemaining]);

  const serverRemaining = session?.remaining_seconds ?? meeting?.remaining_seconds ?? 0;
  const reservedSeconds = Math.max(0, (session?.allocated_duration_minutes ?? 0) * 60);
  const isWaiting = Boolean(session && !session.timer_started && session.waiting_for);
  const displayRemaining = session?.timer_started
    ? (localRemaining ?? serverRemaining)
    : isWaiting && reservedSeconds > 0
      ? reservedSeconds
      : serverRemaining;
  const communicationMode = resolveCommunicationMode(
    searchParams,
    meeting?.communication_mode,
    session?.booking?.communication_mode,
  );

  if (!sid) {
    return <p className="text-muted-foreground">{c.missingSession}</p>;
  }

  if (sessionError) {
    return (
      <Card className="max-w-lg border-destructive/40">
        <CardHeader>
          <CardTitle className="font-serif text-xl">{c.cannotOpen}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{(sessionError as Error).message}</p>
          <Button asChild variant="outline">
            <Link to={role === "mentor" ? "/mentor/messages" : "/user/messages"}>{c.backToInbox}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return <p className="animate-pulse text-muted-foreground">{c.loading}</p>;
  }

  const isEnded = session.status === "ended";
  const needsPayment = sessionNeedsInitialPayment(session);
  const joinWindowExpired = sessionJoinWindowExpired(session);
  const timeUp = sessionTimeExpired(session);
  // Users can pay to start, extend mid-session, or continue after time ran out / ended / join miss.
  const showExtend = role === "user";
  const resumeMode = isEnded || timeUp || needsPayment || joinWindowExpired;

  const partnerPresenceLabel =
    role === "user"
      ? session.partner_is_online
        ? c.coachOnline
        : c.coachOfflineWaiting
      : session.partner_is_online
        ? c.userOnline
        : c.userOfflineWaiting;

  const extendButton = showExtend ? (
    <Button type="button" variant="secondary" size="sm" onClick={() => setExtendOpen(true)}>
      <Clock className="mr-1 h-4 w-4" />
      {needsPayment ? c.payToStart : resumeMode ? c.continueChat : c.extend}
    </Button>
  ) : null;

  const mentorProfilePath = session.mentor_id ? `/mentors/${session.mentor_id}` : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
            <Link to={role === "mentor" ? "/mentor/messages" : "/user/messages"}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
          </Button>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-accent font-bold">
              {needsPayment
                ? c.awaitingPayment
                : joinWindowExpired
                  ? c.joinExpired
                  : isEnded
                    ? c.ended
                    : timeUp
                      ? c.timeUp
                      : c.liveSession}
            </p>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl leading-tight">{c.title}</h1>
              {session.partner_is_online != null && (isWaiting || !session.timer_started) ? (
                <PresenceIndicator
                  status={session.partner_is_online ? "online" : "offline"}
                  showLabel
                />
              ) : null}
            </div>
            {session.partner_is_online != null && isWaiting ? (
              <p className="text-xs text-muted-foreground mt-0.5">{partnerPresenceLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session.status !== "ended" ? <LiveClock /> : null}
          <div
            className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-center"
            title={
              needsPayment
                ? c.paymentRequired
                : joinWindowExpired
                  ? c.joinWindowExpired
                  : isWaiting
                    ? c.sessionNotStartedYet
                    : c.timeRemaining
            }
          >
            {needsPayment ? (
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.awaitingPayment}</p>
                <p className="font-mono text-lg tabular-nums">—</p>
                <p className="text-[10px] text-muted-foreground">{c.notStarted}</p>
              </div>
            ) : joinWindowExpired ? (
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.joinExpired}</p>
                <p className="font-mono text-lg tabular-nums">0:00</p>
              </div>
            ) : isWaiting ? (
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {waitingLabel(session.waiting_for, role, c)}
                </p>
                <p className="text-[10px] text-muted-foreground">{c.timerNotStarted}</p>
                <p className="font-mono text-lg tabular-nums">{formatCountdown(displayRemaining)}</p>
                <p className="text-[10px] text-muted-foreground">{c.reserved}</p>
              </div>
            ) : (
              <p className="font-mono text-lg tabular-nums">{formatCountdown(displayRemaining)}</p>
            )}
          </div>
          {extendButton}
          {role === "user" && mentorProfilePath && isEnded ? (
            <Button asChild type="button" variant="outline" size="sm">
              <Link to={mentorProfilePath}>{c.bookAgain}</Link>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={session.status === "ended" || endMut.isPending}
            onClick={() => {
              const coachMissed = role === "user" && (!session.timer_started || session.waiting_for === "mentor");
              const confirmMsg = coachMissed ? c.confirmEndCoachMissed : c.confirmEndNormal;
              if (window.confirm(confirmMsg)) {
                endMut.mutate();
              }
            }}
          >
            {c.endChat}
          </Button>
        </div>
      </div>

      {session.timer_paused_for_payment ? (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-950 dark:text-sky-100">
          {c.timerPausedForPayment}
        </div>
      ) : null}

      {role === "user" && isEnded && !session.timer_started ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100 flex items-center justify-between gap-3">
          <span>{c.refundBanner}</span>
          <Button asChild size="sm" variant="outline" className="border-emerald-600/40 text-emerald-800 dark:text-emerald-200 shrink-0">
            <Link to="/user/wallet">{c.viewWallet}</Link>
          </Button>
        </div>
      ) : null}

      {needsPayment ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {role === "user" ? c.needsPaymentUser : c.needsPaymentMentor}
        </div>
      ) : null}

      {joinWindowExpired ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {role === "user" ? c.joinExpiredUser : c.joinExpiredMentor}
        </div>
      ) : null}

      {isWaiting ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {waitingLabel(session.waiting_for, role, c)}.{" "}
          {role === "mentor" ? c.waitingBannerSuffixClient : c.waitingBannerSuffixCoach}
        </div>
      ) : null}

      {waitingForCoachOnly && coachWaitAlertReady ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-950 dark:text-amber-50 flex flex-wrap items-center justify-between gap-3">
          <span>{c.coachNoShowBanner}</span>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={endMut.isPending}
              onClick={() => {
                endingForNewCoachRef.current = true;
                setEndingForNewCoach(true);
                endMut.mutate();
              }}
            >
              {endingForNewCoach && endMut.isPending ? c.coachNoShowEnding : c.coachNoShowEndAndFind}
            </Button>
          </div>
        </div>
      ) : null}

      {role === "mentor" && (timeUp || isEnded || needsPayment || joinWindowExpired) ? (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {isEnded
            ? c.mentorEnded
            : needsPayment
              ? c.mentorNeedsPayment
              : joinWindowExpired
                ? c.mentorJoinExpired
                : c.mentorTimeUp}
        </div>
      ) : null}

      {session.booking ? <SessionBookingDetails booking={session.booking} /> : null}

      <MeetingPanel
        sessionId={sid}
        meeting={meeting}
        communicationMode={communicationMode}
        autoJoin={communicationMode !== null}
        extendControl={extendButton}
        continueControl={extendButton}
        mentorProfilePath={role === "user" ? mentorProfilePath : null}
      />

      <ChatPanel sessionId={sid} session={session} />

      {showExtend ? (
        <>
          <SessionExtendDialog
            sessionId={sid}
            open={extendOpen}
            onOpenChange={setExtendOpen}
            resumeMode={resumeMode}
            communicationMode={communicationMode}
          />
          {!isEnded && !needsPayment && !joinWindowExpired ? (
            <SessionExpiryWarningDialog
              open={expiryWarningOpen}
              remainingSeconds={displayRemaining}
              urgency={warningUrgency}
              onExtend={() => {
                setExpiryWarningOpen(false);
                setExtendOpen(true);
              }}
              onDismiss={() => setExpiryWarningOpen(false)}
            />
          ) : null}
        </>
      ) : null}

      <CoachNoShowDialog
        open={coachNoShowOpen && waitingForCoachOnly}
        ending={endingForNewCoach && endMut.isPending}
        onKeepWaiting={() => setCoachNoShowOpen(false)}
        onEndAndFindCoach={() => {
          endingForNewCoachRef.current = true;
          setEndingForNewCoach(true);
          endMut.mutate();
        }}
      />
    </div>
  );
};

export default ChatSessionPage;
