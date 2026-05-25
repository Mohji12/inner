import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getChatWebSocketUrl } from "@/api/constants";
import type { ChatMessage } from "@/api/types";

type ConnectionStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "auth_missing";

const MAX_RECONNECT_ATTEMPTS = 8;

interface UseChatWebSocketOptions {
  sessionId: string;
  token: string | null;
  onMessage?: (type: string, data: any) => void;
  role: string;
}

/**
 * Tracks which WebSocket generation is live. Closing/replacing a socket must NOT
 * schedule reconnect — old sockets' `onclose` must no-op once superseded/unmounted.
 */
export const useChatWebSocket = ({ sessionId, token, onMessage, role }: UseChatWebSocketOptions) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    !sessionId || !token ? "auth_missing" : "connecting",
  );
  const onMessageRef = useRef<UseChatWebSocketOptions["onMessage"]>(onMessage);
  const wsRef = useRef<WebSocket | null>(null);
  const wsGenerationRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!sessionId || !token) {
      setStatus("disconnected");
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    wsGenerationRef.current += 1;
    const socketGeneration = wsGenerationRef.current;

    const prev = wsRef.current;
    if (prev) {
      prev.close();
      wsRef.current = null;
    }

    const url = getChatWebSocketUrl(sessionId, token);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (socketGeneration !== wsGenerationRef.current) return;
      setStatus("connected");
      reconnectAttemptsRef.current = 0;

      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data as string) as { type?: string; data?: any };

        if (parsed.type === "new_message" && parsed.data?.id) {
          const msg = parsed.data as ChatMessage;
          const msgKey = ["chat", "messages", sessionId] as const;
          const prev = queryClient.getQueryData<ChatMessage[]>(msgKey);
          if (!prev?.length) {
            void queryClient.invalidateQueries({ queryKey: msgKey });
          } else if (!prev.some((m) => m.id === msg.id)) {
            queryClient.setQueryData<ChatMessage[]>(
              msgKey,
              [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at)),
            );
          }
          void queryClient.invalidateQueries({ queryKey: ["chat", "session", sessionId] });
        }
        if (parsed.type === "session") {
          void queryClient.invalidateQueries({ queryKey: ["chat", "session", sessionId] });
        }
        if (parsed.type === "read_receipt") {
          if (parsed.data?.role !== role) {
            void queryClient.invalidateQueries({ queryKey: ["chat", "messages", sessionId] });
          }
        }

        if (onMessageRef.current && parsed.type) {
          onMessageRef.current(parsed.type, parsed.data);
        }
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    ws.onclose = (ev) => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (socketGeneration !== wsGenerationRef.current) {
        return;
      }
      wsRef.current = null;

      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        setStatus("disconnected");
        return;
      }

      setStatus("reconnecting");

      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId, token, queryClient, role]);

  useEffect(() => {
    connect();
    return () => {
      wsGenerationRef.current += 1;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      reconnectAttemptsRef.current = 0;
      setStatus("disconnected");
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  return { status, sendMessage };
};
