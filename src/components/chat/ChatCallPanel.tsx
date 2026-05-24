import type { ChatSession } from "@/api/types";
import type { MeetingOut } from "@/api/meetings";
import { MeetingPanel, type SessionCommunicationMode } from "@/components/meeting/MeetingPanel";

type Props = {
  sessionId: string;
  session: ChatSession;
  communicationMode?: SessionCommunicationMode | null;
  autoStart?: boolean;
};

function chatSessionToMeeting(session: ChatSession): MeetingOut {
  const canJoin =
    session.status !== "ended" &&
    session.remaining_seconds > 0 &&
    (session.status === "active" || session.status === "paused");
  return {
    chat_session_id: session.id,
    room_name: `chat-${session.id}`,
    communication_mode: null,
    status: session.status,
    ends_at: session.ends_at,
    remaining_seconds: session.remaining_seconds,
    can_join: canJoin,
  };
}

/** @deprecated Use MeetingPanel with GET /meetings/sessions/{id} instead. */
export function ChatCallPanel({ sessionId, session, communicationMode, autoStart }: Props) {
  return (
    <MeetingPanel
      sessionId={sessionId}
      meeting={chatSessionToMeeting(session)}
      communicationMode={communicationMode}
      autoJoin={autoStart}
    />
  );
}

export type { SessionCommunicationMode };
