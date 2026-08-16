import { useEffect, useRef } from "react";
import { bindNotificationAudioUnlock, playNotificationChime } from "@/lib/notificationSound";

/** Plays the dashboard chime when new ids appear after the first snapshot. */
export function useNotificationChime(ids: string[], enabled: boolean) {
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    bindNotificationAudioUnlock();
  }, []);

  useEffect(() => {
    initializedRef.current = false;
    seenRef.current = new Set();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!initializedRef.current) {
      seenRef.current = new Set(ids);
      initializedRef.current = true;
      return;
    }
    if (ids.some((id) => !seenRef.current.has(id))) {
      playNotificationChime();
    }
    seenRef.current = new Set(ids);
  }, [enabled, ids]);
}
