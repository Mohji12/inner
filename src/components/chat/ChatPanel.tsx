import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { listChatMessages, markChatSessionAsRead, sendChatImageMessage, sendChatMessage } from "@/api/chat";
import { useChatWebSocket } from "@/hooks/useChatWebSocket";
import { ConnectionStatusBar } from "@/components/chat/ConnectionStatusBar";
import type { ChatMessage, ChatSession } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Check, CheckCheck, ImagePlus, X } from "lucide-react";
import { formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";
import { mediaUrlFromApi } from "@/lib/mediaUrl";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TOO_LARGE_MESSAGE = "Image is more than 2 MB.";

type Props = {
  sessionId: string;
  session: ChatSession;
};

function isImageMessage(message: ChatMessage): boolean {
  if (!message.attachment_url) return false;
  const type = message.attachment_type ?? "";
  return type.startsWith("image/") || type === "";
}

function appendMessage(list: ChatMessage[] | undefined, newMsg: ChatMessage): ChatMessage[] {
  const prev = list ?? [];
  if (prev.some((m) => m.id === newMsg.id)) return prev;
  return [...prev, newMsg].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function ChatPanel({ sessionId, session }: Props) {
  const effectiveTimeZone = useEffectiveTimeZone();
  const { role, userAccessToken, mentorAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const wsToken = role === "mentor" ? mentorAccessToken : userAccessToken;
  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (!pendingImage) {
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingImage);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

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
  }, [sortedMessages.length, isOtherTyping, pendingPreviewUrl]);

  const onSendSuccess = useCallback(
    (newMsg: ChatMessage) => {
      setDraft("");
      setPendingImage(null);
      sendTyping(false);
      queryClient.setQueryData<ChatMessage[]>(["chat", "messages", sessionId], (prev) =>
        appendMessage(prev, newMsg),
      );
      void queryClient.invalidateQueries({ queryKey: ["chat", "session", sessionId] });
      void queryClient.invalidateQueries({ queryKey: ["chat", "inbox"] });
    },
    [queryClient, sendTyping, sessionId],
  );

  const sendTextMut = useMutation({
    mutationFn: (body: string) => sendChatMessage(sessionId, { body }),
    onSuccess: onSendSuccess,
    onError: (e: Error) => toast.error(e.message),
  });

  const sendImageMut = useMutation({
    mutationFn: ({ file, caption }: { file: File; caption: string }) =>
      sendChatImageMessage(sessionId, file, caption),
    onSuccess: onSendSuccess,
    onError: (e: Error) => {
      const msg = e.message.toLowerCase().includes("2 mb") ? IMAGE_TOO_LARGE_MESSAGE : e.message;
      toast.error(msg);
    },
  });

  const isSending = sendTextMut.isPending || sendImageMut.isPending;

  const clearPendingImage = () => {
    setPendingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onPickImage = () => {
    fileInputRef.current?.click();
  };

  const onImageSelected = (file: File | undefined) => {
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(IMAGE_TOO_LARGE_MESSAGE);
      return;
    }
    setPendingImage(file);
  };

  const onSend = useCallback(() => {
    const caption = draft.trim();
    if (pendingImage) {
      if (pendingImage.size > MAX_IMAGE_BYTES) {
        toast.error(IMAGE_TOO_LARGE_MESSAGE);
        clearPendingImage();
        return;
      }
      sendImageMut.mutate({ file: pendingImage, caption });
      return;
    }
    if (!caption) return;
    sendTextMut.mutate(caption);
  }, [draft, pendingImage, sendImageMut, sendTextMut]);

  const canSend = session.status === "active" && session.remaining_seconds > 0;
  const canSubmit = canSend && !isSending && (Boolean(pendingImage) || Boolean(draft.trim()));

  return (
    <Card className="border-border/60 shadow-xl shadow-black/5 overflow-hidden">
      <ConnectionStatusBar status={wsStatus} />
      <CardContent className="p-0">
        <div ref={listRef} className="max-h-[min(60vh,520px)] space-y-4 overflow-y-auto p-4 bg-muted/5 scroll-smooth">
          {sortedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <p className="text-sm font-medium">Start the conversation</p>
              <p className="text-xs text-muted-foreground max-w-[200px]">Send a message or share an image to begin.</p>
            </div>
          ) : (
            sortedMessages.map((m) => {
              const mine =
                (role === "user" && m.sender_role === "user") ||
                (role === "mentor" && m.sender_role === "mentor");
              const senderLabel =
                m.sender_display_name?.trim() ||
                (m.sender_role === "user" ? "User" : "Coach");
              const imageUrl = isImageMessage(m) ? mediaUrlFromApi(m.attachment_url) : undefined;
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <p
                    className={`mb-1 px-1 text-[11px] font-semibold ${
                      mine ? "text-primary/80" : "text-muted-foreground"
                    }`}
                  >
                    {senderLabel}
                  </p>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      mine
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "border border-border/70 bg-card text-foreground rounded-tl-none"
                    }`}
                  >
                    {imageUrl ? (
                      <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={imageUrl}
                          alt={m.attachment_filename ?? "Shared image"}
                          className="max-h-64 max-w-full rounded-lg object-contain"
                          loading="lazy"
                        />
                      </a>
                    ) : null}
                    {m.body.trim() ? (
                      <p className={`whitespace-pre-wrap break-words ${imageUrl ? "mt-2" : ""}`}>{m.body}</p>
                    ) : null}
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
        <div className="border-t border-border/60 p-4 bg-card space-y-3">
          {pendingImage && pendingPreviewUrl ? (
            <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <img
                src={pendingPreviewUrl}
                alt="Selected image preview"
                className="h-20 w-20 rounded-md object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pendingImage.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(pendingImage.size / 1024).toFixed(0)} KB · add an optional caption below
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={clearPendingImage} aria-label="Remove image">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onImageSelected(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={!canSend || isSending}
              onClick={onPickImage}
              aria-label="Share image"
              className="shrink-0"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Input
              placeholder={
                canSend
                  ? pendingImage
                    ? "Add a caption (optional)…"
                    : "Type a message…"
                  : "Time expired or chat ended"
              }
              value={draft}
              disabled={!canSend || isSending}
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
              disabled={!canSubmit}
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
