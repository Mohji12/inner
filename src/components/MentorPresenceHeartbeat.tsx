import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { heartbeatMentorPresence } from "@/api/mentors";
import { useAuth } from "@/auth/AuthContext";

const HEARTBEAT_MS = 30_000;

export default function MentorPresenceHeartbeat() {
  const { role, mentorAccessToken } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (role !== "mentor" || !mentorAccessToken) return;

    let disposed = false;
    const ping = async () => {
      try {
        await heartbeatMentorPresence();
        if (!disposed) {
          void queryClient.invalidateQueries({ queryKey: ["mentors"] });
          // Prefix match: ["mentor", id] public profile + similar lists
          void queryClient.invalidateQueries({ queryKey: ["mentor"] });
        }
      } catch {
        // Ignore transient network/auth errors; next heartbeat retries.
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

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [role, mentorAccessToken, queryClient]);

  return null;
}
