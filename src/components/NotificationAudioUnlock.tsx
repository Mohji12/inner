import { useEffect } from "react";
import { bindNotificationAudioUnlock } from "@/lib/notificationSound";

/** Unlocks notification audio after the first click or keypress anywhere in the app. */
export function NotificationAudioUnlock() {
  useEffect(() => {
    bindNotificationAudioUnlock();
  }, []);
  return null;
}
