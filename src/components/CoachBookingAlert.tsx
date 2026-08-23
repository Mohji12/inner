import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { getNotifications } from "@/api/notifications";
import { useAuth } from "@/auth/AuthContext";
import {
  bindCoachBookingAudioUnlock,
  isBookingNotificationType,
  playNotificationChime,
} from "@/lib/notificationSound";

/**
 * Plays the booking alert on the coach dashboard only when a user newly books a session.
 * Existing unread notifications on dashboard load are ignored (no sound on open).
 */
export function CoachBookingAlert() {
  const { role } = useAuth();
  const location = useLocation();
  const onCoachDashboard = role === "mentor" && location.pathname.startsWith("/mentor");
  const baselineIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!onCoachDashboard) {
      baselineIdsRef.current = null;
      return;
    }
    baselineIdsRef.current = null;
    bindCoachBookingAudioUnlock();
  }, [onCoachDashboard]);

  const { data, isSuccess } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => getNotifications(5, 0),
    refetchInterval: 10_000,
    enabled: onCoachDashboard,
  });

  useEffect(() => {
    if (!onCoachDashboard || !isSuccess) return;
    const notifications = data?.notifications ?? [];

    if (baselineIdsRef.current === null) {
      baselineIdsRef.current = new Set(notifications.map((n) => n.id));
      return;
    }

    for (const notif of notifications) {
      if (baselineIdsRef.current.has(notif.id)) continue;
      baselineIdsRef.current.add(notif.id);
      if (notif.is_read) continue;
      if (!isBookingNotificationType(notif.type)) continue;
      playNotificationChime("booking");
      break;
    }
  }, [onCoachDashboard, isSuccess, data?.notifications]);

  return null;
}
