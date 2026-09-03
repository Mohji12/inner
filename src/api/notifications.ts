import { apiFetch } from "./client";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  notifications: Notification[];
  unread_count: number;
}

export function getNotifications(limit = 20, offset = 0): Promise<NotificationList> {
  return apiFetch<NotificationList>(`/notifications?limit=${limit}&offset=${offset}`);
}

export function markNotificationAsRead(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsAsRead(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/notifications/read-all`, { method: "POST" });
}

export function deleteNotification(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/notifications/${id}`, { method: "DELETE" });
}
