import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ensureFreshAccessToken } from "@/api/client";
import { heartbeatMentorPresence } from "@/api/mentors";
import { useAuthOptional } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const HEARTBEAT_MS = 30_000;
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

  useEffect(() => {
    if (role !== "mentor" || !mentorAccessToken) return;

    let disposed = false;
    const ping = async () => {
      try {
        await ensureFreshAccessToken();
        await heartbeatMentorPresence();
        if (disposed) return;
        failCountRef.current = 0;
        toastShownRef.current = false;
        void queryClient.invalidateQueries({ queryKey: ["mentors"] });
        void queryClient.invalidateQueries({ queryKey: ["mentor"] });
        void queryClient.invalidateQueries({ queryKey: ["mentor", "presence-status"] });
      } catch {
        if (disposed) return;
        failCountRef.current += 1;
        if (failCountRef.current >= FAILURES_BEFORE_TOAST && !toastShownRef.current) {
          toastShownRef.current = true;
          toast.warning(d.presenceHeartbeatFailed, { duration: 10_000 });
        }
      }
    };

    void ping();
    const intervalId = window.setInterval(() => {
      void ping();
    }, HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (!document.hidden) void ping();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", () => void ping());
    window.addEventListener("focus", () => void ping());

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [role, mentorAccessToken, queryClient, d.presenceHeartbeatFailed]);

  return null;
}
