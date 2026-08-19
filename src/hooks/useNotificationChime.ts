import { useEffect, useRef } from "react";
import {
  bindNotificationAudioUnlock,
  playNotificationChime,
  type NotificationSoundKind,
} from "@/lib/notificationSound";

export type NotificationChimeItem = {
  id: string;
  sound?: NotificationSoundKind;
};

/** Plays the dashboard chime when new ids appear after the first snapshot. */
export function useNotificationChime(
  items: Array<string | NotificationChimeItem>,
  enabled: boolean,
) {
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
    const normalized: NotificationChimeItem[] = items.map((item) =>
      typeof item === "string" ? { id: item, sound: "default" } : item,
    );
    const ids = normalized.map((item) => item.id);
    if (!initializedRef.current) {
      seenRef.current = new Set(ids);
      initializedRef.current = true;
      return;
    }
    const fresh = normalized.filter((item) => !seenRef.current.has(item.id));
    if (fresh.length > 0) {
      const kind: NotificationSoundKind = fresh.some((item) => item.sound === "booking")
        ? "booking"
        : "default";
      playNotificationChime(kind);
    }
    seenRef.current = new Set(ids);
  }, [enabled, items]);
}
