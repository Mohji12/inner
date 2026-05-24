import type { ReactNode } from "react";
import type { MeetingCommunicationMode, MeetingOut } from "@/api/meetings";
import { useMeetingRoom } from "@/hooks/useMeetingRoom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

type Props = {
  sessionId: string;
  meeting: MeetingOut | null | undefined;
  communicationMode?: MeetingCommunicationMode | null;
  autoJoin?: boolean;
  /** Shown in meeting controls (voice and video) so users can extend without leaving the call. */
  extendControl?: ReactNode;
};

export function MeetingPanel({
  sessionId,
  meeting,
  communicationMode = null,
  autoJoin = false,
  extendControl = null,
}: Props) {
  const { t } = useLanguage();
  const {
    isVoiceMeeting,
    isVideoMeeting,
    isBookedMeeting,
    videoEnabled,
    sessionEnded,
    canMeet,
    phase,
    muted,
    cameraOn,
    lastError,
    hasRemoteVideo,
    hasRemoteParticipant,
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,
    joinMeeting,
    disconnect,
    toggleMute,
    toggleCamera,
  } = useMeetingRoom({
    sessionId,
    meeting,
    communicationMode,
    autoJoin,
  });

  const notConfigured = lastError?.toLowerCase().includes("not configured");

  const title = isVoiceMeeting ? "Voice meeting" : isVideoMeeting ? "Video meeting" : t.app.chatCallPanel.title;

  const description = sessionEnded
    ? "This session has ended. Start a new booking from the coach profile to meet again."
    : isVoiceMeeting
      ? "Talk through your device microphone in the meeting room. Video is disabled for this session."
      : isVideoMeeting
        ? "Talk with microphone and camera in the meeting room. Chat works alongside the call."
        : t.app.chatCallPanel.descriptionStart;

  const joinLabel =
    phase === "connecting"
      ? t.app.chatCallPanel.connecting
      : isBookedMeeting
        ? "Join meeting"
        : t.app.chatCallPanel.joinCall;

  const remoteVideoPlaceholder =
    phase === "connected" && !hasRemoteParticipant
      ? "Waiting for the other participant to join the meeting…"
      : phase === "connected" && hasRemoteParticipant && !hasRemoteVideo
        ? isVideoMeeting
          ? "Other participant is connected — waiting for their camera…"
          : t.app.chatCallPanel.waitingForRemoteVideo
        : isVideoMeeting
          ? "Join the meeting to connect video and audio."
          : t.app.chatCallPanel.joinToConnect;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-lg">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessionEnded ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            Session ended — meeting and chat are closed for this booking.
          </div>
        ) : null}
        {videoEnabled ? (
          <div className="relative grid gap-2 sm:grid-cols-2">
            <div className="relative min-h-[140px] overflow-hidden rounded-lg border border-dashed border-border/70 bg-muted/30 sm:min-h-[180px]">
              <div ref={remoteVideoRef} className="absolute inset-0" />
              {!hasRemoteVideo ? (
                <div className="flex h-full min-h-[140px] items-center justify-center px-2 text-center text-xs text-muted-foreground sm:min-h-[180px]">
                  {remoteVideoPlaceholder}
                </div>
              ) : null}
            </div>
            <div className="relative flex min-h-[140px] items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/20 sm:min-h-[180px]">
              <video
                ref={localVideoRef}
                className={`h-full w-full object-cover ${cameraOn ? "opacity-100" : "opacity-0"}`}
                playsInline
                muted
              />
              {!cameraOn ? (
                <span className="absolute px-2 text-center text-xs text-muted-foreground">
                  {phase === "connected" ? "Your camera is off — tap Video on to share." : t.app.chatCallPanel.cameraOff}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-center">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                phase === "connected" && !muted ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
              }`}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </div>
            <p className="text-sm text-muted-foreground">
              {sessionEnded
                ? "Session ended."
                : phase === "connected" && !hasRemoteParticipant
                  ? "You are in the meeting — waiting for the other participant to join."
                  : phase === "connected"
                    ? muted
                      ? "Microphone muted — unmute to speak in the meeting."
                      : "In voice meeting — your microphone is live. Video is off."
                    : "Join the meeting to talk with your microphone. Video is disabled."}
            </p>
          </div>
        )}
        <div ref={remoteAudioRef} className="sr-only" aria-hidden />

        {notConfigured ? (
          <p className="text-sm text-muted-foreground">
            {t.app.chatCallPanel.notConfigured} (<code className="text-xs">LIVEKIT_URL</code>
            , API key, and secret). {t.app.chatCallPanel.see} <code className="text-xs">backend/README.md</code>.
          </p>
        ) : null}

        {lastError && !notConfigured && !sessionEnded ? (
          <p className="text-sm text-destructive">{lastError}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {extendControl && !sessionEnded ? extendControl : null}
          {phase === "idle" || phase === "connecting" ? (
            <Button
              type="button"
              size="sm"
              disabled={!canMeet || sessionEnded || phase === "connecting" || !meeting}
              onClick={() => void joinMeeting({ enableCamera: isVideoMeeting })}
            >
              <Phone className="mr-1 h-4 w-4" />
              {joinLabel}
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" variant="secondary" onClick={() => void toggleMute()}>
                {muted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
                {muted ? t.app.chatCallPanel.unmute : t.app.chatCallPanel.mute}
              </Button>
              {videoEnabled && isVideoMeeting ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => void toggleCamera()}>
                  {cameraOn ? <VideoOff className="mr-1 h-4 w-4" /> : <Video className="mr-1 h-4 w-4" />}
                  {cameraOn ? t.app.chatCallPanel.videoOff : t.app.chatCallPanel.videoOn}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => void disconnect({ userInitiated: true })}>
                <PhoneOff className="mr-1 h-4 w-4" />
                {t.app.chatCallPanel.leave}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export type { MeetingCommunicationMode as SessionCommunicationMode };
