import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getChatSession, listChatSessions } from "@/api/chat";
import { saveMentorBookingInvoicePdf } from "@/api/invoices";
import { listMentorBookings, patchBookingAsMentor } from "@/api/bookings";
import type { ChatInboxSession } from "@/api/types";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { chatSessionCardCaption } from "@/lib/chatSessionCardCaption";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import {
  canOpenBookingChat,
  chatSessionById,
  meetingLinkSessionId,
  sortBookingsForDisplay,
  standaloneChatSessions,
} from "@/lib/bookingChatLinks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function toMentorChatPath(sessionId: string): string {
  return `/mentor/chat/${sessionId}`;
}

function normalizeMentorMeetingLink(link: string | null): string | null {
  if (!link) return null;
  const match = link.match(/\/user\/chat\/([^/?#]+)(\?[^#]*)?/i);
  if (match) {
    return `/mentor/chat/${match[1]}${match[2] ?? ""}`;
  }
  return link;
}

const MentorAppointmentsPage = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
  const effectiveTimeZone = useEffectiveTimeZone();
  const highlightedSessionId = (searchParams.get("sessionId") || "").trim();
  const [isConfirmingSession, setIsConfirmingSession] = useState(false);
  const sessionReadyToastShownRef = useRef(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", "mentor", "me"],
    queryFn: listMentorBookings,
  });

  const chatInboxQuery = useQuery({
    queryKey: ["chat", "sessions", "mentor", "appointments"],
    queryFn: listChatSessions,
    refetchInterval: 30_000,
  });

  const patchMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patchBookingAsMentor(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings", "mentor", "me"] });
      toast.success("Booking updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDownloadInvoice = async (bookingId: string) => {
    setDownloadingInvoiceId(bookingId);
    try {
      await saveMentorBookingInvoicePdf(bookingId);
      toast.success("Invoice downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not download invoice");
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const chatSessions = chatInboxQuery.data?.sessions ?? [];
  const chatSessionMap = useMemo(() => chatSessionById(chatSessions), [chatSessions]);
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
          void queryClient.invalidateQueries({ queryKey: ["chat", "sessions", "mentor", "appointments"] });
          if (!sessionReadyToastShownRef.current) {
            sessionReadyToastShownRef.current = true;
            toast.success("Live session is ready to join.");
          }
          return;
        }
      } catch {
        // Ignore transient state while webhook settles.
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

  if (bookings.length === 0 && instantChatSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">No sessions yet</CardTitle>
          <CardDescription>Sessions appear after a user pays for a booking or starts a live chat.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">Appointments</p>
        <h1 className="font-serif text-3xl">Your sessions</h1>
        <p className="mt-1 max-w-xl text-xs text-muted-foreground">
          Each paid booking appears once. Instant chat (Talk now) history is listed separately when applicable.
        </p>
      </div>

      {highlightedSessionId && isConfirmingSession ? (
        <Card className="border-border/60">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Confirming payment and activating live session. This may take a few seconds after Mollie redirect.
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
                role: "mentor",
              },
              effectiveTimeZone,
            );
            return (
              <Card key={s.id} className={isHighlighted ? "border-accent/60 ring-1 ring-accent/50" : "border-border/60"}>
                <CardContent className="space-y-3 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{s.partner_name || "User"}</p>
                      <p className="text-sm text-muted-foreground">{cap.primaryLine}</p>
                      {cap.secondaryLine ? (
                        <p className="mt-1 text-xs text-muted-foreground">{cap.secondaryLine}</p>
                      ) : null}
                      {s.last_message_body ? <p className="mt-1 text-xs text-muted-foreground">{s.last_message_body}</p> : null}
                    </div>
                    <Badge variant={canJoin ? "default" : "secondary"}>{s.status}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canJoin ? (
                      <Button size="sm" className="gradient-cta text-white" asChild>
                        <Link to={toMentorChatPath(s.id)}>Join session</Link>
                      </Button>
                    ) : null}
                    {s.status === "ended" ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={toMentorChatPath(s.id)}>View history</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link to={toMentorChatPath(s.id)}>
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
        {sortedBookings.map((b) => {
          const startUtc = new Date(b.start_at_utc);
          const endUtc = new Date(b.end_at_utc);
          const now = new Date();
          const normalizedMeetingLink = normalizeMentorMeetingLink(b.meeting_link);
          const linkedChat = (() => {
            const sessionId = meetingLinkSessionId(b.meeting_link);
            return sessionId ? chatSessionMap.get(sessionId) : undefined;
          })();
          const canJoinSession = canOpenBookingChat(
            { ...b, meeting_link: normalizedMeetingLink },
            linkedChat,
            now,
          );
          const isLiveSession = canJoinSession;
          return (
            <Card key={b.id} className={isLiveSession ? "border-accent/60 ring-1 ring-accent/50" : "border-border/60"}>
              <CardContent className="space-y-3 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-muted-foreground">Booking {b.id.slice(0, 8)}...</p>
                      {isLiveSession ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Current session</Badge>
                      ) : null}
                    </div>
                    <p className="font-medium">
                      {formatDateLocal(startUtc, { year: "numeric", month: "2-digit", day: "2-digit" }, effectiveTimeZone)}{" "}
                      · {formatTimeLocal(startUtc, undefined, effectiveTimeZone)} –{" "}
                      {formatTimeLocal(endUtc, undefined, effectiveTimeZone)} · {b.duration} min
                    </p>
                    {b.session_topic ? <p className="mt-2 text-sm">{b.session_topic}</p> : null}
                    {b.problem_description ? <p className="mt-1 text-sm text-muted-foreground">{b.problem_description}</p> : null}
                    {b.goals_expected ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Goals: </span>
                        {b.goals_expected}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {b.experience_level ? <span>Level: {b.experience_level}</span> : null}
                      {b.urgency_level ? <span>Urgency: {b.urgency_level}</span> : null}
                      {b.communication_mode ? <span>Mode: {b.communication_mode}</span> : null}
                      {b.preferred_language ? <span>Language: {b.preferred_language}</span> : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge>{b.status}</Badge>
                    <p className="mt-1 text-sm text-muted-foreground">Payment: {b.payment_status}</p>
                  </div>
                </div>

                {linkedChat && isLiveSession ? (
                  <p className="text-xs text-muted-foreground">
                    Live chat: {linkedChat.status === "active" ? "ready to join" : linkedChat.status}
                  </p>
                ) : null}

                {normalizedMeetingLink && isLiveSession ? (
                  <p className="text-sm">
                    <Link to={normalizedMeetingLink} className="text-accent underline-offset-4 hover:underline">
                      Open meeting room
                    </Link>
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {canJoinSession && normalizedMeetingLink ? (
                    <Button size="sm" className="gradient-cta text-white" asChild>
                      <Link to={normalizedMeetingLink}>
                        {linkedChat?.status === "active" ? "Join session" : "Open chatroom"}
                      </Link>
                    </Button>
                  ) : null}
                  {b.payment_status === "paid" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingInvoiceId === b.id}
                      onClick={() => void handleDownloadInvoice(b.id)}
                    >
                      Download invoice
                    </Button>
                  ) : null}
                  {b.status === "confirmed" ? (
                    <>
                      <Button
                        size="sm"
                        className="gradient-cta text-white"
                        onClick={() => patchMut.mutate({ id: b.id, status: "completed" })}
                        disabled={patchMut.isPending}
                      >
                        Mark completed
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => patchMut.mutate({ id: b.id, status: "unattended" })}
                        disabled={patchMut.isPending}
                      >
                        Mark no-show
                      </Button>
                    </>
                  ) : null}
                  {b.status !== "cancelled" && b.status !== "completed" && b.status !== "unattended" ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => patchMut.mutate({ id: b.id, status: "cancelled" })}
                      disabled={patchMut.isPending}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default MentorAppointmentsPage;