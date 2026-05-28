import { useState, useEffect, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { endChatSession, getChatSession, joinChatSession } from "@/api/chat";
import { getMeeting } from "@/api/meetings";
import type { MeetingCommunicationMode } from "@/api/meetings";
import type { ChatSession } from "@/api/types";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { SessionExtendDialog } from "@/components/chat/SessionExtendDialog";
import { SessionExpiryWarningDialog } from "@/components/chat/SessionExpiryWarningDialog";
import { LiveClock } from "@/components/LiveClock";
import { SessionBookingDetails } from "@/components/SessionBookingDetails";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { MeetingPanel } from "@/components/meeting/MeetingPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock } from "lucide-react";

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function resolveCommunicationMode(
  searchParams: URLSearchParams,
  meetingMode: MeetingCommunicationMode | null | undefined,
): MeetingCommunicationMode | null {
  const fromUrl = searchParams.get("mode");
  if (fromUrl === "call" || fromUrl === "video") return fromUrl;
  if (meetingMode === "call" || meetingMode === "video") return meetingMode;
  return null;
}

function waitingLabel(waitingFor: ChatSession["waiting_for"], role: string | null): string {
  if (!waitingFor) return "Waiting to start…";
  if (waitingFor === "mentor") return role === "mentor" ? "User is waiting for you" : "Waiting for coach…";
  if (waitingFor === "user") return role === "user" ? "Coach is waiting for you" : "Waiting for user…";
  return "Waiting for both participants…";
}

const ChatSessionPage = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [extendOpen, setExtendOpen] = useState(false);
  const [expiryWarningOpen, setExpiryWarningOpen] = useState(false);
  const [warningUrgency, setWarningUrgency] = useState<"initial" | "final">("initial");
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const firstWarningAt = useRef<number | null>(null);
  const secondWarningShown = useRef(false);

  const sid = sessionId ?? "";

  const sessionQuery = useQuery({
    queryKey: ["chat", "session", sid],
    queryFn: () => getChatSession(sid),
    enabled: Boolean(sid),
    refetchInterval: (q) => {
      const d = q.state.data as ChatSession | undefined;
      if (!d) return 1000;
      if (d.status === "ended") return false;
      if (!d.timer_started && d.waiting_for) return 2000;
      return 5000;
    },
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

  const meetingQuery = useQuery({
    queryKey: ["meeting", "session", sid],
    queryFn: () => getMeeting(sid),
    enabled: Boolean(sid),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 1000;
      if (d.status === "ended") return false;
      return 5000;
    },
  });

  const session = sessionQuery.data;
  const meeting = meetingQuery.data;
  const sessionError = sessionQuery.error;

  const endMut = useMutation({
    mutationFn: () => endChatSession(sid),
    onSuccess: () => {
      toast.message("Chat ended");
      void queryClient.invalidateQueries({ queryKey: ["chat", "session", sid] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "session", "booking-link", sid] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions", "appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings", "me"] });
      void queryClient.invalidateQueries({ queryKey: ["meeting", "session", sid] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "mentor-active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (session?.remaining_seconds != null) {
      setLocalRemaining(session.remaining_seconds);
    }
  }, [session?.remaining_seconds]);

  useEffect(() => {
    if (!session?.timer_started || session.status === "ended") return;
    const interval = window.setInterval(() => {
      setLocalRemaining((prev) => (prev != null ? Math.max(0, prev - 1) : prev));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session?.timer_started, session?.status]);

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
        toast.warning("Your session is about to end. If you want to extend, you can extend it now.", {
          duration: 10_000,
        });
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [role, session?.timer_started]);

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
  const communicationMode = resolveCommunicationMode(searchParams, meeting?.communication_mode);

  if (!sid) {
    return <p className="text-muted-foreground">Missing session</p>;
  }

  if (sessionError) {
    return (
      <Card className="max-w-lg border-destructive/40">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Cannot open chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{(sessionError as Error).message}</p>
          <Button asChild variant="outline">
            <Link to={role === "mentor" ? "/mentor/messages" : "/user/messages"}>Back to Inbox</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return <p className="animate-pulse text-muted-foreground">Loading live session…</p>;
  }

  const showExtend =
    role === "user" &&
    session.status !== "ended" &&
    (session.timer_started || session.allocated_duration_minutes == null);

  const partnerPresenceLabel =
    role === "user"
      ? session.partner_is_online
        ? "Coach is online"
        : "Coach is offline — waiting for them to join"
      : session.partner_is_online
        ? "User is online"
        : "User is offline — waiting for them to join";

  const extendButton = showExtend ? (
    <Button type="button" variant="secondary" size="sm" onClick={() => setExtendOpen(true)}>
      <Clock className="mr-1 h-4 w-4" />
      Extend
    </Button>
  ) : null;

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
            <p className="text-[10px] uppercase tracking-widest text-accent font-bold">Live session</p>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl leading-tight">Chat</h1>
              {session.partner_is_online != null ? (
                <PresenceIndicator
                  status={session.partner_is_online ? "online" : "offline"}
                  showLabel
                />
              ) : null}
            </div>
            {session.partner_is_online != null && !session.timer_started ? (
              <p className="text-xs text-muted-foreground mt-0.5">{partnerPresenceLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {session.status !== "ended" ? <LiveClock /> : null}
          <div
            className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-center"
            title={isWaiting ? "Session has not started yet" : "Time remaining"}
          >
            {isWaiting ? (
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {waitingLabel(session.waiting_for, role)}
                </p>
                <p className="text-[10px] text-muted-foreground">Timer not started</p>
                <p className="font-mono text-lg tabular-nums">{formatCountdown(displayRemaining)}</p>
                <p className="text-[10px] text-muted-foreground">reserved</p>
              </div>
            ) : (
              <p className="font-mono text-lg tabular-nums">{formatCountdown(displayRemaining)}</p>
            )}
          </div>
          {extendButton}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={session.status === "ended" || endMut.isPending}
            onClick={() => endMut.mutate()}
          >
            End chat
          </Button>
        </div>
      </div>

      {isWaiting ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {waitingLabel(session.waiting_for, role)}. The session timer will start once both you and your{" "}
          {role === "mentor" ? "client" : "coach"} are in the room.
        </div>
      ) : null}

      {session.booking ? <SessionBookingDetails booking={session.booking} /> : null}

      <MeetingPanel
        sessionId={sid}
        meeting={meeting}
        communicationMode={communicationMode}
        autoJoin={communicationMode !== null}
        extendControl={extendButton}
      />

      <ChatPanel sessionId={sid} session={session} />

      {showExtend ? (
        <>
          <SessionExtendDialog sessionId={sid} open={extendOpen} onOpenChange={setExtendOpen} />
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
        </>
      ) : null}
    </div>
  );
};

export default ChatSessionPage;
