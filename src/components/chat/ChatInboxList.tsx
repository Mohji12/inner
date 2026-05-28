import React from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ChatInboxSession } from "@/api/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { SessionBookingDetails } from "@/components/SessionBookingDetails";
import { cn } from "@/lib/utils";

interface ChatInboxListProps {
  sessions: ChatInboxSession[];
  role: "user" | "mentor";
}

const ChatInboxList = ({ sessions, role }: ChatInboxListProps) => {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 border rounded-xl border-dashed">
        <p className="text-muted-foreground">No conversations yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const unreadCount = role === "user" ? session.unread_count_user : session.unread_count_mentor;
        const lastMsgAt = session.last_message_at || session.created_at;
        const chatUrl = role === "user" ? `/user/chat/${session.id}` : `/mentor/chat/${session.id}`;

        return (
          <Link
            key={session.id}
            to={chatUrl}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border border-border/60 hover:border-accent/40 hover:bg-accent/5 transition-all group",
              unreadCount > 0 ? "bg-accent/5 border-accent/20" : "bg-card"
            )}
          >
            <div className="relative shrink-0">
              <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                <AvatarImage src={session.partner_profile_image || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-serif">
                  {session.partner_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 rounded-full bg-background p-0.5">
                <PresenceIndicator
                  status={session.partner_is_online ? "online" : "offline"}
                />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <h3 className={cn("font-serif text-lg leading-tight truncate", unreadCount > 0 ? "font-bold" : "font-medium")}>
                  {session.partner_name}
                </h3>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(lastMsgAt), { addSuffix: true })}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <p className={cn(
                  "text-sm truncate pr-4",
                  unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {session.last_message_role === role ? "You: " : ""}
                  {session.last_message_body || "No messages yet"}
                </p>
                {unreadCount > 0 && (
                  <Badge variant="default" className="bg-accent text-accent-foreground h-5 min-w-5 flex items-center justify-center rounded-full p-0 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              {session.booking ? (
                <SessionBookingDetails booking={session.booking} variant="inline" className="mt-1.5" />
              ) : null}
            </div>
            
            <div className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pr-1">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

export default ChatInboxList;
