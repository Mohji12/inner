import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { listChatMessages, markChatSessionAsRead, sendChatMessage } from "@/api/chat";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { ConnectionStatusBar } from "@/components/chat/ConnectionStatusBar";
import type { ChatMessage, ChatSession } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, CheckCheck } from "lucide-react";
import { formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";

type Props = {
  sessionId: string;
  session: ChatSession;
};

export function ChatPanel({ sessionId, session }: Props) {
  const effectiveTimeZone = useEffectiveTimeZone();
  const { role, userAccessToken, mentorAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const wsToken = role === "mentor" ? mentorAccessToken : userAccessToken;
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [draft, setDraft] = useState("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const handleWsMessage = useCallback(
    (type: string, data: { role?: string; is_typing?: boolean }) => {
      if (type === "typing") {
        if (data?.role !== role) {
          setIsOtherTyping(data?.is_typing || false);
        }
      }
    },
    [role],
  );

  const { status: wsStatus, sendMessage: wsSendMessage } = useChatWebSocket({
    sessionId,
    token: wsToken,
    role,
    onMessage: handleWsMessage,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["chat", "messages", sessionId],
    queryFn: () => listChatMessages(sessionId, { limit: 200 }),
    enabled: Boolean(sessionId) && Boolean(session),
    refetchInterval: () => {
      if (!session || session.status === "ended") return false;
      if (wsStatus === "connected") return false;
      return 7000;
    },
  });

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages],
  );

  const markReadMut = useMutation({
    mutationFn: () => markChatSessionAsRead(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "inbox"] });
    },
  });

  useEffect(() => {
    if (sessionId && session.status === "active") {
      const unread = role === "user" ? session.unread_count_user : session.unread_count_mentor;
      if (unread > 0) {
        markReadMut.mutate();
      }
    }
  }, [sessionId, session.unread_count_user, session.unread_count_mentor, session.status, role]);

  const sendTyping = (isTyping: boolean) => {
    wsSendMessage("typing", { is_typing: isTyping });
  };

  const handleDraftChange = (val: string) => {
    setDraft(val);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
    }, 3000);
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [sortedMessages.length, isOtherTyping]);

  const sendMut = useMutation({
    mutationFn: (body: string) => sendChatMessage(sessionId, { body }),
    onSuccess: (newMsg) => {
      setDraft("");
      sendTyping(false);
      queryClient.setQueryData<ChatMessage[]>(["chat", "messages", sessionId], (prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === newMsg.id)) return list;
        return [...list, newMsg].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      void queryClient.invalidateQueries({ queryKey: ["chat", "session", sessionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSend = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    sendMut.mutate(t);
  }, [draft, sendMut]);

  const canSend = session.status === "active" && session.remaining_seconds > 0;

  return (
    <Card className="border-border/60 shadow-xl shadow-black/5 overflow-hidden">
      <ConnectionStatusBar status={wsStatus} />
      <CardContent className="p-0">
        <div ref={listRef} className="max-h-[min(60vh,520px)] space-y-4 overflow-y-auto p-4 bg-muted/5 scroll-smooth">
          {sortedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <p className="text-sm font-medium">Start the conversation</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">Send a message to begin your session.</p>
            </div>
          ) : (
            sortedMessages.map((m) => {
              const mine =
                (role === "user" && m.sender_role === "user") ||
                (role === "mentor" && m.sender_role === "mentor");
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "border border-border/70 bg-card text-foreground rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <p className="text-[10px] text-muted-foreground/70">
                      {formatTimeLocal(m.created_at, undefined, effectiveTimeZone)}
                    </p>
                    {mine && (
                      <span className="text-primary/70">
                        {m.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {isOtherTyping && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/70 px-4 py-2 rounded-2xl rounded-tl-none shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-border/60 p-4 bg-card">
          <div className="flex gap-2">
            <Input
              placeholder={canSend ? "Type a message…" : "Time expired or chat ended"}
              value={draft}
              disabled={!canSend || sendMut.isPending}
              className="bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/20"
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
            <Button
              type="button"
              disabled={!canSend || sendMut.isPending || !draft.trim()}
              onClick={onSend}
              className="shadow-md shadow-primary/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 mr-2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
