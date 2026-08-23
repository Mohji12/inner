import { useEffect } from "react";
import { bindDefaultNotificationAudioUnlock } from "@/lib/notificationSound";

/** Unlocks chat/notification audio after the first click or keypress (silent). */
export function NotificationAudioUnlock() {
  useEffect(() => {
    bindDefaultNotificationAudioUnlock();
  }, []);
  return null;
}
