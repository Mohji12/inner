import { apiFetch, apiFetchBlob } from "./client";
import type {
  ChatCallToken,
  ChatDialOut,
  ChatPhoneBridgeIn,
  ChatPhoneBridgeOut,
  ChatInvoiceDetail,
  ChatInvoiceSummary,
  ChatMessage,
  ChatSession,
  ChatSessionCheckout,
  ChatSessionExtendQuote,
  ChatInbox,
} from "./types";

export interface ChatSessionStartBody {
  mentor_id: string;
  minutes: number;
  checkout_currency?: string | null;
}

export interface InstantSessionStartBody {
  mentor_id: string;
  checkout_currency?: string | null;
}

export interface ChatSessionExtendBody {
  minutes: number;
  checkout_currency?: string | null;
}

export function startChatSession(body: ChatSessionStartBody): Promise<ChatSessionCheckout> {
  return apiFetch<ChatSessionCheckout>("/chat/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function startInstantSession(body: InstantSessionStartBody): Promise<ChatSessionCheckout> {
  return apiFetch<ChatSessionCheckout>("/chat/instant-sessions/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function extendChatSession(sessionId: string, body: ChatSessionExtendBody): Promise<ChatSessionCheckout> {
  return apiFetch<ChatSessionCheckout>(`/chat/sessions/${sessionId}/extend`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getChatSessionExtendQuote(
  sessionId: string,
  params: { minutes: number; checkout_currency?: string },
): Promise<ChatSessionExtendQuote> {
  const sp = new URLSearchParams();
  sp.set("minutes", String(params.minutes));
  if (params.checkout_currency) sp.set("checkout_currency", params.checkout_currency);
  return apiFetch<ChatSessionExtendQuote>(`/chat/sessions/${sessionId}/extend/quote?${sp.toString()}`);
}

export function getChatSession(sessionId: string): Promise<ChatSession> {
  return apiFetch<ChatSession>(`/chat/sessions/${sessionId}`);
}

export function listChatSessions(): Promise<ChatInbox> {
  return apiFetch<ChatInbox>("/chat/sessions");
}

export function markChatSessionAsRead(sessionId: string): Promise<ChatSession> {
  return apiFetch<ChatSession>(`/chat/sessions/${sessionId}/read`, {
    method: "POST",
  });
}

/** @deprecated Use fetchMeetingToken from @/api/meetings */
export function postChatCallToken(sessionId: string): Promise<ChatCallToken> {
  return apiFetch<ChatCallToken>(`/meetings/sessions/${sessionId}/token`, {
    method: "POST",
  });
}

/** Ring the other participant's mobile (profile phone, E.164) into the same LiveKit room via SIP. */
export function postChatCallDial(sessionId: string): Promise<ChatDialOut> {
  return apiFetch<ChatDialOut>(`/chat/sessions/${sessionId}/call/dial`, {
    method: "POST",
  });
}

/** Dial two outbound numbers into the same LiveKit room (phone bridge). */
export function postChatCallBridge(body: ChatPhoneBridgeIn): Promise<ChatPhoneBridgeOut> {
  return apiFetch<ChatPhoneBridgeOut>("/chat/call/bridge", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function sendChatMessage(
  sessionId: string,
  body: { body: string; body_i18n?: Record<string, string> | null },
): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function sendChatImageMessage(
  sessionId: string,
  file: File,
  caption?: string,
): Promise<ChatMessage> {
  const form = new FormData();
  form.append("file", file);
  if (caption?.trim()) form.append("body", caption.trim());
  return apiFetch<ChatMessage>(`/chat/sessions/${sessionId}/messages/image`, {
    method: "POST",
    body: form,
  });
}

export function listChatMessages(
  sessionId: string,
  params?: { since_id?: string; limit?: number },
): Promise<ChatMessage[]> {
  const sp = new URLSearchParams();
  if (params?.since_id) sp.set("since_id", params.since_id);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const q = sp.toString();
  return apiFetch<ChatMessage[]>(`/chat/sessions/${sessionId}/messages${q ? `?${q}` : ""}`);
}

export function endChatSession(sessionId: string): Promise<ChatSession> {
  return apiFetch<ChatSession>(`/chat/sessions/${sessionId}/end`, { method: "POST" });
}

export function getMentorActiveChatSession(): Promise<ChatSession | null> {
  return apiFetch<ChatSession | null>("/chat/sessions/active/me");
}

export function listChatInvoices(): Promise<ChatInvoiceSummary[]> {
  return apiFetch<ChatInvoiceSummary[]>("/chat/invoices");
}

export function getChatInvoice(sessionId: string): Promise<ChatInvoiceDetail> {
  return apiFetch<ChatInvoiceDetail>(`/chat/invoices/${sessionId}`);
}

/** Download invoice as PDF (server-generated). */
export function downloadChatInvoicePdf(sessionId: string) {
  return apiFetchBlob(`/chat/invoices/${sessionId}/pdf`);
}

export function listMentorChatInvoices(): Promise<ChatInvoiceSummary[]> {
  return apiFetch<ChatInvoiceSummary[]>("/chat/mentor/invoices");
}

export function getMentorChatInvoice(sessionId: string): Promise<ChatInvoiceDetail> {
  return apiFetch<ChatInvoiceDetail>(`/chat/mentor/invoices/${sessionId}`);
}

export function downloadMentorChatInvoicePdf(sessionId: string) {
  return apiFetchBlob(`/chat/mentor/invoices/${sessionId}/pdf`);
}
