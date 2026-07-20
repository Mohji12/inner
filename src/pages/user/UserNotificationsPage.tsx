import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, CalendarDays, Check, MessageSquare, Receipt, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from "@/api/notifications";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";

const UserNotificationsPage = () => {
  const { t } = useLanguage();
  const n = t.app.userNotifications;
  const [filter, setFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: () => getNotifications(50, 0),
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

  const notifications = data?.notifications || [];
  
  const filteredNotifications = notifications.filter(notif => {
    if (filter === "all") return true;
    return notif.type === filter;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "booking": return <CalendarDays className="h-5 w-5 text-blue-500" />;
      case "chat": return <MessageSquare className="h-5 w-5 text-green-500" />;
      case "payment": return <Receipt className="h-5 w-5 text-yellow-500" />;
      default: return <Info className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold">{n.title}</h1>
          <p className="text-muted-foreground mt-1">{n.description}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending || !data?.unread_count}
          >
            <Check className="mr-2 h-4 w-4" />
            {n.markAllRead}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 pb-2 overflow-x-auto">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>{n.filterAll}</Button>
        <Button variant={filter === "booking" ? "default" : "outline"} size="sm" onClick={() => setFilter("booking")}>{n.filterBookings}</Button>
        <Button variant={filter === "chat" ? "default" : "outline"} size="sm" onClick={() => setFilter("chat")}>{n.filterMessages}</Button>
        <Button variant={filter === "payment" ? "default" : "outline"} size="sm" onClick={() => setFilter("payment")}>{n.filterPayments}</Button>
      </div>

      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center px-4 space-y-3">
            <p className="text-muted-foreground">{n.loadError}</p>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              {n.retry}
            </Button>
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-border/50">
            {filteredNotifications.map((notif) => (
              <div 
                key={notif.id} 
                className={cn(
                  "p-5 flex gap-4 transition-colors group relative",
                  !notif.is_read ? "bg-accent/5" : "bg-transparent",
                  notif.link && "hover:bg-accent/10 cursor-pointer"
                )}
                onClick={() => {
                  if (!notif.is_read) markAsRead.mutate(notif.id);
                  if (notif.link) window.location.href = notif.link;
                }}
              >
                {!notif.is_read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
                <div className="shrink-0 mt-1 bg-background rounded-full p-2 border border-border/50 shadow-sm">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={cn("text-base", !notif.is_read ? "font-semibold" : "font-medium")}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {format(new Date(notif.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">{notif.body}</p>
                </div>
                <div className="shrink-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notif.is_read && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead.mutate(notif.id);
                      }}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotif.mutate(notif.id);
                    }}
                    title="Delete notification"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center px-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-medium text-foreground">{n.emptyTitle}</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
              {filter === "all" 
                ? n.emptyAll
                : n.emptyFiltered.replace("{type}", filter)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserNotificationsPage;
