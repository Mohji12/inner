import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track } from "livekit-client";
import { fetchMeetingToken } from "@/api/meetings";
import type { MeetingCommunicationMode, MeetingOut } from "@/api/meetings";
import { toast } from "sonner";

export type MeetingPhase = "idle" | "connecting" | "connected";

export type UseMeetingRoomOptions = {
  sessionId: string;
  meeting: MeetingOut | null | undefined;
  communicationMode?: MeetingCommunicationMode | null;
  autoJoin?: boolean;
};

export function useMeetingRoom({
  sessionId,
  meeting,
  communicationMode = null,
  autoJoin = false,
}: UseMeetingRoomOptions) {
  const mode = communicationMode ?? meeting?.communication_mode ?? null;
  const isVoiceMeeting = mode === "call";
  const isVideoMeeting = mode === "video";
  const isBookedMeeting = isVoiceMeeting || isVideoMeeting;
  const videoEnabled = !isVoiceMeeting;

  const meetingReady = meeting != null;
  const remainingSeconds = meeting?.remaining_seconds ?? 0;
  const sessionStatus = meeting?.status ?? "loading";
  const timerStarted = Boolean(meeting?.timer_started);
  const hasReservedTime = (meeting?.allocated_duration_minutes ?? 0) > 0 || Boolean(meeting?.waiting_for);
  /** Permanent end only — never while meeting payload is still loading. */
  const sessionEnded = meetingReady && sessionStatus === "ended";
  /** Unpaid checkout: paused, never started, no reserved minutes. */
  const needsPayment =
    meetingReady &&
    !sessionEnded &&
    !timerStarted &&
    remainingSeconds <= 0 &&
    !hasReservedTime &&
    sessionStatus === "paused";
  /** Paid booking join deadline missed (timer never started). */
  const joinWindowExpired =
    meetingReady &&
    !sessionEnded &&
    !needsPayment &&
    !timerStarted &&
    remainingSeconds <= 0 &&
    (meeting?.allocated_duration_minutes ?? 0) > 0;
  /** Paid session that ran out of minutes (not unpaid). */
  const timeExpired =
    meetingReady && !sessionEnded && !needsPayment && !joinWindowExpired && timerStarted && remainingSeconds <= 0;
  const canMeet =
    meetingReady &&
    !sessionEnded &&
    !timeExpired &&
    !needsPayment &&
    !joinWindowExpired &&
    (sessionStatus === "active" || sessionStatus === "paused") &&
    remainingSeconds > 0 &&
    (meeting?.can_join ?? false);
  const shouldAutoJoin = autoJoin && canMeet && isBookedMeeting;

  const roomRef = useRef<Room | null>(null);
  const remoteAudioRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const joinGenerationRef = useRef(0);
  const autoJoinDoneRef = useRef(false);
  const userLeftRef = useRef(false);

  const [phase, setPhase] = useState<MeetingPhase>("idle");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasRemoteParticipant, setHasRemoteParticipant] = useState(false);

  const isJoinStale = (joinId: number) => joinId !== joinGenerationRef.current;

  const teardownRoom = useCallback(async (room: Room | null) => {
    if (!room) return;
    try {
      if (room.state !== ConnectionState.Disconnected) {
        await room.disconnect();
      }
    } catch {
      /* ignore teardown races in dev strict mode */
    }
  }, []);

  const resetMediaElements = useCallback(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.innerHTML = "";
    if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, []);

  const disconnect = useCallback(
    async (opts?: { userInitiated?: boolean }) => {
      if (opts?.userInitiated) {
        userLeftRef.current = true;
      }
      joinGenerationRef.current += 1;
      const room = roomRef.current;
      roomRef.current = null;
      await teardownRoom(room);
      setPhase("idle");
      setMuted(false);
      setCameraOn(false);
      setHasRemoteVideo(false);
      setHasRemoteParticipant(false);
      resetMediaElements();
    },
    [resetMediaElements, teardownRoom],
  );

  useEffect(() => {
    joinGenerationRef.current += 1;
    autoJoinDoneRef.current = false;
    userLeftRef.current = false;
    setHasRemoteParticipant(false);
    setHasRemoteVideo(false);
    setPhase("idle");
    setLastError(null);

    return () => {
      joinGenerationRef.current += 1;
      const room = roomRef.current;
      roomRef.current = null;
      void teardownRoom(room);
    };
  }, [sessionId, teardownRoom]);

  useEffect(() => {
    if (!sessionEnded) return;
    void disconnect();
  }, [disconnect, sessionEnded]);

  const attachLocalPreview = useCallback((room: Room) => {
    const el = localVideoRef.current;
    if (!el) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = pub?.track;
    if (track) {
      track.attach(el);
    }
  }, []);

  const joinMeeting = useCallback(
    async (opts?: { enableCamera?: boolean }) => {
      if (!canMeet || sessionEnded || userLeftRef.current) return;
      if (roomRef.current?.state === ConnectionState.Connected) return;

      const joinId = joinGenerationRef.current;
      setLastError(null);
      setPhase("connecting");

      let room: Room | null = null;
      try {
        const { url, token } = await fetchMeetingToken(sessionId);
        if (isJoinStale(joinId)) return;

        room = new Room({ adaptiveStream: true, dynacast: true });

        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (participant.identity === room?.localParticipant.identity) return;
          setHasRemoteParticipant(true);
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            remoteAudioRef.current?.appendChild(el);
          }
          if (videoEnabled && track.kind === Track.Kind.Video) {
            setHasRemoteVideo(true);
            const el = track.attach();
            el.style.maxWidth = "100%";
            el.style.borderRadius = "8px";
            el.style.height = "100%";
            el.style.objectFit = "cover";
            remoteVideoRef.current?.appendChild(el);
          }
        });

        room.on(RoomEvent.ParticipantConnected, () => {
          setHasRemoteParticipant(true);
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
        });

        room.on(RoomEvent.Disconnected, () => {
          if (roomRef.current === room) {
            roomRef.current = null;
          }
          if (!isJoinStale(joinId)) {
            setPhase("idle");
          }
        });

        if (isJoinStale(joinId)) {
          await teardownRoom(room);
          return;
        }

        roomRef.current = room;
        await room.connect(url, token);
        if (isJoinStale(joinId)) {
          await teardownRoom(room);
          if (roomRef.current === room) roomRef.current = null;
          return;
        }

        await room.localParticipant.setMicrophoneEnabled(true);
        setMuted(false);

        const enableCamera = Boolean(opts?.enableCamera) && videoEnabled && isVideoMeeting;
        await room.localParticipant.setCameraEnabled(enableCamera);
        if (isJoinStale(joinId)) {
          await teardownRoom(room);
          if (roomRef.current === room) roomRef.current = null;
          return;
        }

        setCameraOn(enableCamera);
        if (enableCamera) {
          requestAnimationFrame(() => attachLocalPreview(room!));
        }

        try {
          await room.startAudio();
        } catch {
          /* browser may block until further gesture */
        }

        if (isJoinStale(joinId)) {
          await teardownRoom(room);
          if (roomRef.current === room) roomRef.current = null;
          return;
        }

        setPhase("connected");
      } catch (e) {
        if (isJoinStale(joinId)) return;
        const msg = e instanceof Error ? e.message : "Could not join meeting";
        setLastError(msg);
        if (msg.toLowerCase().includes("ended")) {
          toast.error("This session has ended. You can buy more minutes to continue, or book a new session.");
        } else if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("join window")) {
          toast.error("This session window expired. Pay to continue the same chat, or book a new session.");
        } else {
          toast.error(msg);
        }
        await teardownRoom(room);
        if (roomRef.current === room) roomRef.current = null;
        setPhase("idle");
      }
    },
    [attachLocalPreview, canMeet, isVideoMeeting, sessionEnded, sessionId, teardownRoom, videoEnabled],
  );

  useEffect(() => {
    if (!shouldAutoJoin || autoJoinDoneRef.current || userLeftRef.current) return;
    const timer = window.setTimeout(() => {
      if (autoJoinDoneRef.current || userLeftRef.current || !shouldAutoJoin) return;
      if (roomRef.current?.state === ConnectionState.Connected) return;
      autoJoinDoneRef.current = true;
      void joinMeeting({ enableCamera: isVideoMeeting });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isVideoMeeting, joinMeeting, shouldAutoJoin]);

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const nextMuted = !muted;
    await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  };

  const toggleCamera = async () => {
    if (!videoEnabled || isVoiceMeeting) return;
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
    if (next) {
      requestAnimationFrame(() => attachLocalPreview(room));
    } else if (localVideoRef.current) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      pub?.track?.detach(localVideoRef.current);
      localVideoRef.current.srcObject = null;
    }
  };

  return {
    mode,
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
  };
}
