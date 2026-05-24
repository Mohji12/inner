import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Trash2, CalendarDays, MessageSquare, Receipt, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, type Notification } from "@/api/notifications";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => getNotifications(5, 0),
    refetchInterval: 30000, // Poll every 30s
  });

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

  const unreadCount = data?.unread_count || 0;
  const notifications = data?.notifications || [];

  const getIcon = (type: string) => {
    switch (type) {
      case "booking": return <CalendarDays className="h-4 w-4 text-blue-500" />;
      case "chat": return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "payment": return <Receipt className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
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
      <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden border-border/50 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/50">
          <DropdownMenuLabel className="p-0 font-semibold text-sm">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
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
                    if (!notif.is_read) markAsRead.mutate(notif.id);
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
                  
                  {/* Action buttons appear on hover */}
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
            <Link to="/user/notifications">View all notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
