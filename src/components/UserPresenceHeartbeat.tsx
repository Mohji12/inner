import { useEffect } from "react";
import { heartbeatUserPresence } from "@/api/users";
import { useAuthOptional } from "@/auth/AuthContext";

const HEARTBEAT_MS = 30_000;

export default function UserPresenceHeartbeat() {
  const auth = useAuthOptional();
  const role = auth?.role ?? null;
  const userAccessToken = auth?.userAccessToken ?? null;

  useEffect(() => {
    if (role !== "user" || !userAccessToken) return;

    let disposed = false;
    const ping = async () => {
      try {
        await heartbeatUserPresence();
      } catch {
        // Retry on next interval.
      }
    };

    void ping();
    const intervalId = window.setInterval(() => {
      if (!disposed) void ping();
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
  }, [role, userAccessToken]);

  return null;
}
