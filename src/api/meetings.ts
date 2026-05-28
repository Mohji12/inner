import { apiFetch } from "./client";

export type MeetingCommunicationMode = "video" | "call";

export interface MeetingOut {
  chat_session_id: string;
  room_name: string;
  communication_mode: MeetingCommunicationMode | null;
  status: string;
  ends_at: string;
  remaining_seconds: number;
  can_join: boolean;
  timer_started: boolean;
  waiting_for: "user" | "mentor" | "both" | null;
  allocated_duration_minutes: number | null;
}

export interface MeetingTokenResponse {
  provider: string;
  url: string;
  token: string;
  room_name: string;
  expires_in_seconds: number;
}

export function getMeeting(chatSessionId: string): Promise<MeetingOut> {
  return apiFetch<MeetingOut>(`/meetings/sessions/${chatSessionId}`);
}

export function fetchMeetingToken(chatSessionId: string): Promise<MeetingTokenResponse> {
  return apiFetch<MeetingTokenResponse>(`/meetings/sessions/${chatSessionId}/token`, {
    method: "POST",
  });
}
