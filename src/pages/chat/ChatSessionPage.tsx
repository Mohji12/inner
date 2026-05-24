import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { endChatSession, getChatSession } from "@/api/chat";
import { getMeeting } from "@/api/meetings";
import type { MeetingCommunicationMode } from "@/api/meetings";
import type { ChatSession } from "@/api/types";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { SessionExtendDialog } from "@/components/chat/SessionExtendDialog";
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

const ChatSessionPage = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [extendOpen, setExtendOpen] = useState(false);

  const sid = sessionId ?? "";

  const sessionQuery = useQuery({
    queryKey: ["chat", "session", sid],
    queryFn: () => getChatSession(sid),
    enabled: Boolean(sid),
    refetchInterval: (q) => {
      const d = q.state.data as ChatSession | undefined;
      if (!d) return 1000;
      if (d.status === "ended") return false;
      return 5000;
    },
  });

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

  const countdownSeconds = session?.remaining_seconds ?? meeting?.remaining_seconds ?? 0;
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

  const showExtend = role === "user" && session.status !== "ended";

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
            <h1 className="font-serif text-2xl leading-tight">Chat</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-center font-mono text-lg tabular-nums"
            title="Time remaining"
          >
            {formatCountdown(countdownSeconds)}
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

      <MeetingPanel
        sessionId={sid}
        meeting={meeting}
        communicationMode={communicationMode}
        autoJoin={communicationMode !== null}
        extendControl={extendButton}
      />

      <ChatPanel sessionId={sid} session={session} />

      {showExtend ? (
        <SessionExtendDialog sessionId={sid} open={extendOpen} onOpenChange={setExtendOpen} />
      ) : null}
    </div>
  );
};

export default ChatSessionPage;
