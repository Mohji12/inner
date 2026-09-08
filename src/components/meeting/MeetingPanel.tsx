import type { ReactNode } from "react";
import { Link } from "react-router-dom";
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
  /** User-only: continue / book again after time up or permanent end. */
  continueControl?: ReactNode;
  mentorProfilePath?: string | null;
};

export function MeetingPanel({
  sessionId,
  meeting,
  communicationMode = null,
  autoJoin = false,
  extendControl = null,
  continueControl = null,
  mentorProfilePath = null,
}: Props) {
  const { t } = useLanguage();
  const p = t.app.chatCallPanel;
  const {
    isVoiceMeeting,
    isVideoMeeting,
    isBookedMeeting,
    videoEnabled,
    sessionEnded,
    timeExpired,
    needsPayment,
    joinWindowExpired,
    meetingReady,
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

  const title = isVoiceMeeting ? p.voiceMeeting : isVideoMeeting ? p.videoMeeting : p.title;

  const description = !meetingReady
    ? p.loadingMeeting
    : sessionEnded
      ? p.descEnded
      : needsPayment
        ? p.descNeedsPayment
        : joinWindowExpired
          ? p.descJoinExpired
          : timeExpired
            ? p.descTimeExpired
            : isVoiceMeeting
              ? p.descVoice
              : isVideoMeeting
                ? p.descVideo
                : p.descriptionStart;

  const joinLabel =
    phase === "connecting"
      ? p.connecting
      : isBookedMeeting
        ? p.joinMeeting
        : p.joinCall;

  const remoteVideoPlaceholder =
    phase === "connected" && !hasRemoteParticipant
      ? p.waitingForParticipant
      : phase === "connected" && hasRemoteParticipant && !hasRemoteVideo
        ? isVideoMeeting
          ? p.waitingForTheirCamera
          : p.waitingForRemoteVideo
        : isVideoMeeting
          ? p.joinMeetingToConnect
          : p.joinToConnect;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="font-serif text-lg">{title}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {meetingReady && sessionEnded ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {p.bannerEnded}
            <div className="mt-2 flex flex-wrap gap-2">
              {continueControl}
              {mentorProfilePath ? (
                <Button asChild type="button" size="sm" variant="outline">
                  <Link to={mentorProfilePath}>{p.bookAgain}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        {meetingReady && needsPayment && !sessionEnded ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {p.bannerNeedsPayment}
            <div className="mt-2 flex flex-wrap gap-2">{continueControl ?? extendControl}</div>
          </div>
        ) : null}
        {meetingReady && joinWindowExpired && !sessionEnded ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {p.bannerJoinExpired}
            <div className="mt-2 flex flex-wrap gap-2">{continueControl ?? extendControl}</div>
          </div>
        ) : null}
        {meetingReady && timeExpired && !sessionEnded ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {p.bannerTimeUp}
            <div className="mt-2 flex flex-wrap gap-2">{continueControl ?? extendControl}</div>
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
                  {phase === "connected" ? p.cameraOffTap : p.cameraOff}
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
                ? p.statusSessionEnded
                : timeExpired
                  ? p.statusCallPaused
                  : phase === "connected" && !hasRemoteParticipant
                    ? p.statusWaitingParticipant
                    : phase === "connected"
                      ? muted
                        ? p.statusMicMuted
                        : p.statusVoiceLive
                      : p.statusJoinToTalk}
            </p>
          </div>
        )}
        <div ref={remoteAudioRef} className="sr-only" aria-hidden />

        {notConfigured ? (
          <p className="text-sm text-muted-foreground">
            {p.notConfigured} (<code className="text-xs">LIVEKIT_URL</code>
            , API key, and secret). {p.see} <code className="text-xs">backend/README.md</code>.
          </p>
        ) : null}

        {lastError && !notConfigured && !sessionEnded ? (
          <p className="text-sm text-destructive">{lastError}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {extendControl &&
          meetingReady &&
          !sessionEnded &&
          !timeExpired &&
          !needsPayment &&
          !joinWindowExpired
            ? extendControl
            : null}
          {phase === "idle" || phase === "connecting" ? (
            <Button
              type="button"
              size="sm"
              disabled={
                !canMeet ||
                !meetingReady ||
                sessionEnded ||
                timeExpired ||
                needsPayment ||
                joinWindowExpired ||
                phase === "connecting" ||
                !meeting
              }
              onClick={() => void joinMeeting({ enableCamera: isVideoMeeting })}
            >
              <Phone className="mr-1 h-4 w-4" />
              {joinLabel}
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" variant="secondary" onClick={() => void toggleMute()}>
                {muted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
                {muted ? p.unmute : p.mute}
              </Button>
              {videoEnabled && isVideoMeeting ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => void toggleCamera()}>
                  {cameraOn ? <VideoOff className="mr-1 h-4 w-4" /> : <Video className="mr-1 h-4 w-4" />}
                  {cameraOn ? p.videoOff : p.videoOn}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={() => void disconnect({ userInitiated: true })}>
                <PhoneOff className="mr-1 h-4 w-4" />
                {p.leaveCall}
              </Button>
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{p.leaveCallHint}</p>
      </CardContent>
    </Card>
  );
}

export type { MeetingCommunicationMode as SessionCommunicationMode };
