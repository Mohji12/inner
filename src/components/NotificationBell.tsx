import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Trash2, CalendarDays, MessageSquare, Receipt, Info, FileUser, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchAdminCoachApplications, fetchAdminMentors } from "@/api/admin";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from "@/api/notifications";
import { listChatSessions } from "@/api/chat";
import { useAuth } from "@/auth/AuthContext";
import { useNotificationChime } from "@/hooks/useNotificationChime";
import { playNotificationChime } from "@/lib/notificationSound";
import { cn } from "@/lib/utils";

type BellItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  is_read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const isActor = role === "user" || role === "mentor";
  const isAdmin = role === "admin";
  const notificationsPath = role === "mentor"
    ? "/mentor/appointments"
    : role === "admin"
      ? "/admin/coach-applications"
      : "/user/notifications";

  const { data, isSuccess: actorNotifReady } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => getNotifications(5, 0),
    refetchInterval: 10_000,
    enabled: isActor,
  });

  const inboxQuery = useQuery({
    queryKey: ["chat", "inbox"],
    queryFn: listChatSessions,
    refetchInterval: 10_000,
    enabled: isActor,
  });

  const applicationsQuery = useQuery({
    queryKey: ["admin", "alerts", "coach-applications"],
    queryFn: () => fetchAdminCoachApplications(0, 10, undefined, "new"),
    refetchInterval: 15_000,
    enabled: isAdmin,
  });

  const mentorsQuery = useQuery({
    queryKey: ["admin", "alerts", "pending-mentors"],
    queryFn: () => fetchAdminMentors(0, 50),
    refetchInterval: 15_000,
    enabled: isAdmin,
  });

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const inboxUnreadInitRef = useRef(false);
  const lastInboxUnreadRef = useRef(0);

  const actorItems = data?.notifications ?? [];
  const adminItems = useMemo<BellItem[]>(() => {
    if (!isAdmin) return [];
    const applications = (applicationsQuery.data?.items ?? []).map((row) => ({
      id: `application:${row.id}`,
      type: "coach_application",
      title: "New coach application",
      body: row.full_name,
      link: "/admin/coach-applications",
      is_read: false,
      created_at: row.created_at,
    }));
    const pendingMentors = (mentorsQuery.data?.items ?? [])
      .filter((row) => !row.is_approved)
      .slice(0, 10)
      .map((row) => ({
        id: `mentor:${row.id}`,
        type: "pending_mentor",
        title: "Coach awaiting approval",
        body: row.full_name,
        link: "/admin/mentors",
        is_read: false,
        created_at: row.created_at,
      }));
    return [...applications, ...pendingMentors].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [isAdmin, applicationsQuery.data?.items, mentorsQuery.data?.items]);

  const displayItems: BellItem[] = isAdmin ? adminItems : actorItems;
  const chimeIds = useMemo(
    () => (isAdmin ? adminItems.map((item) => item.id) : actorItems.filter((item) => !item.is_read).map((item) => item.id)),
    [isAdmin, adminItems, actorItems],
  );
  const chimeReady = isAdmin
    ? applicationsQuery.isSuccess && mentorsQuery.isSuccess
    : isActor && actorNotifReady;

  useNotificationChime(chimeIds, chimeReady);

  useEffect(() => {
    seenIdsRef.current = new Set();
    initializedRef.current = false;
    inboxUnreadInitRef.current = false;
    lastInboxUnreadRef.current = 0;
  }, [role]);

  useEffect(() => {
    if (!isActor || !actorNotifReady) return;
    const list = data?.notifications ?? [];
    const ids = new Set(list.map((n) => n.id));
    if (!initializedRef.current) {
      seenIdsRef.current = ids;
      initializedRef.current = true;
      return;
    }
    for (const notif of list) {
      if (seenIdsRef.current.has(notif.id) || notif.is_read) continue;
      if (notif.type === "booking_started" || notif.type === "booking_confirmed") {
        toast(notif.title, { description: notif.body, duration: 10_000 });
      }
    }
    seenIdsRef.current = ids;
  }, [data?.notifications, isActor, actorNotifReady]);

  useEffect(() => {
    if (!isActor || !inboxQuery.isSuccess) return;
    const sessions = inboxQuery.data?.sessions ?? [];
    const unread = sessions.reduce((sum, session) => {
      const count = role === "mentor" ? session.unread_count_mentor : session.unread_count_user;
      return sum + (Number(count) || 0);
    }, 0);
    if (!inboxUnreadInitRef.current) {
      lastInboxUnreadRef.current = unread;
      inboxUnreadInitRef.current = true;
      return;
    }
    if (unread > lastInboxUnreadRef.current) {
      playNotificationChime();
    }
    lastInboxUnreadRef.current = unread;
  }, [inboxQuery.data?.sessions, inboxQuery.isSuccess, role, isActor]);

  const markAsRead = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteNotif = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = isAdmin ? displayItems.length : (data?.unread_count || 0);
  const notifications = displayItems;

  const getIcon = (type: string) => {
    switch (type) {
      case "booking":
      case "booking_started":
      case "booking_confirmed":
      case "session_reminder":
        return <CalendarDays className="h-4 w-4 text-blue-500" />;
      case "chat":
      case "new_message":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "payment":
        return <Receipt className="h-4 w-4 text-yellow-500" />;
      case "session_unattended":
        return <Info className="h-4 w-4 text-orange-500" />;
      case "coach_application":
        return <FileUser className="h-4 w-4 text-blue-500" />;
      case "pending_mentor":
        return <Users className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0 overflow-hidden border-border/50 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/50">
          <DropdownMenuLabel className="p-0 font-semibold text-sm">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && isActor && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
          {notifications.length > 0 ? (
            <div className="flex flex-col">
              {notifications.map((notif) => (
                <div 
                  key={notif.id}
                  className={cn(
                    "flex flex-col gap-1 p-4 border-b border-border/50 transition-colors relative group",
                    !notif.is_read ? "bg-accent/10" : "bg-transparent",
                    notif.link ? "cursor-pointer hover:bg-accent/20" : ""
                  )}
                  onClick={() => {
                    if (isActor && !notif.is_read) markAsRead.mutate(notif.id);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 bg-background rounded-full p-1.5 shadow-sm border border-border/40">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <p className={cn("text-sm font-medium leading-tight", !notif.is_read && "text-foreground font-semibold")}>
                        {notif.link ? (
                          <Link to={notif.link} onClick={() => setOpen(false)} className="hover:underline">
                            {notif.title}
                          </Link>
                        ) : (
                          notif.title
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">{notif.body}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-2 font-medium">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  {isActor ? (
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-background shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead.mutate(notif.id);
                        }}
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3 text-green-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full hover:bg-background shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotif.mutate(notif.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                    </Button>
                  </div>
                  ) : null}
                  
                  {!notif.is_read && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-md" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center px-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">You have no new notifications.</p>
            </div>
          )}
        </div>
        <div className="p-2 border-t border-border/50 bg-muted/20">
          <Button asChild variant="ghost" className="w-full h-8 text-xs font-medium justify-center" onClick={() => setOpen(false)}>
            <Link to={notificationsPath}>{isAdmin ? "View admin alerts" : "View all notifications"}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
