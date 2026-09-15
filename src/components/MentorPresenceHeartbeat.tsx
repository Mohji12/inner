import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureFreshAccessToken } from "@/api/client";
import { getMentorPresenceStatus, heartbeatMentorPresence } from "@/api/mentors";
import { useAuthOptional } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

/** Visible-tab interval — mobile Safari throttles long setIntervals hard. */
const HEARTBEAT_VISIBLE_MS = 15_000;
const HEARTBEAT_HIDDEN_MS = 45_000;
const FAILURES_BEFORE_TOAST = 3;

export default function MentorPresenceHeartbeat() {
  const auth = useAuthOptional();
  const role = auth?.role ?? null;
  const mentorAccessToken = auth?.mentorAccessToken ?? null;
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const d = t.app.dashboardMentor;
  const failCountRef = useRef(0);
  const toastShownRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const presenceQuery = useQuery({
    queryKey: ["mentor", "presence-status"],
    queryFn: getMentorPresenceStatus,
    enabled: role === "mentor" && Boolean(mentorAccessToken),
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const presenceMode = presenceQuery.data?.presence_mode ?? "online";
  const heartbeatEnabled = role === "mentor" && Boolean(mentorAccessToken) && presenceMode !== "offline";

  useEffect(() => {
    if (!heartbeatEnabled) {
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
      return;
    }

    let disposed = false;
    let timeoutId = 0;

    const releaseWakeLock = () => {
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };

    const requestWakeLock = async () => {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator) || document.hidden) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch {
        // Not supported / denied — heartbeats still run.
      }
    };

    const scheduleNext = () => {
      if (disposed) return;
      const delay = document.hidden ? HEARTBEAT_HIDDEN_MS : HEARTBEAT_VISIBLE_MS;
      timeoutId = window.setTimeout(() => {
        void ping();
      }, delay);
    };

    const ping = async () => {
      try {
        await ensureFreshAccessToken("mentor");
        await heartbeatMentorPresence();
        if (disposed) return;
        failCountRef.current = 0;
        toastShownRef.current = false;
        void queryClient.invalidateQueries({ queryKey: ["mentor", "presence-status"] });
        if (!document.hidden) void requestWakeLock();
      } catch {
        if (disposed) return;
        failCountRef.current += 1;
        if (failCountRef.current >= FAILURES_BEFORE_TOAST && !toastShownRef.current) {
          toastShownRef.current = true;
          toast.warning(d.presenceHeartbeatFailed, { duration: 10_000 });
        }
      } finally {
        scheduleNext();
      }
    };

    const onVisible = () => {
      if (document.hidden) {
        releaseWakeLock();
        return;
      }
      window.clearTimeout(timeoutId);
      void ping();
    };

    const onPageShow = () => {
      if (!document.hidden) {
        window.clearTimeout(timeoutId);
        void ping();
      }
    };

    void ping();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      disposed = true;
      window.clearTimeout(timeoutId);
      releaseWakeLock();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [heartbeatEnabled, queryClient, d.presenceHeartbeatFailed]);

  return null;
}
