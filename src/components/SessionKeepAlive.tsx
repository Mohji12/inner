import { useEffect } from "react";
import { ensureFreshAccessToken } from "@/api/client";
import { useAuthOptional } from "@/auth/AuthContext";

/**
 * Keeps sessions alive across laptop sleep / lid close / tab focus.
 * Silently refreshes the access token when the page becomes visible again.
 */
export default function SessionKeepAlive() {
  const auth = useAuthOptional();
  const hasSession = Boolean(
    auth?.role &&
      ((auth.role === "user" && auth.userAccessToken) ||
        (auth.role === "mentor" && auth.mentorAccessToken) ||
        (auth.role === "admin" && auth.adminAccessToken)),
  );

  useEffect(() => {
    if (!hasSession) return;

    const refresh = () => {
      void ensureFreshAccessToken();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      // bfcache restore after sleep/lid close
      if (event.persisted) refresh();
      else refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);

    // Periodic refresh while the tab stays open (every 30 minutes).
    const intervalId = window.setInterval(refresh, 30 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(intervalId);
    };
  }, [hasSession]);

  return null;
}
