import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Video } from "lucide-react";
import { listMentorBookings } from "@/api/bookings";
import { getMentorActiveChatSession, listChatSessions } from "@/api/chat";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { resolveMentorLiveJoinTarget } from "@/lib/bookingChatLinks";

/**
 * Fixed bottom join CTA for coaches on mobile so booking toasts cannot cover the accept button.
 */
export function CoachLiveJoinBar() {
  const { t } = useLanguage();
  const d = t.app.mentorDashboardHome;
  const location = useLocation();

  const activeChatQ = useQuery({
    queryKey: ["chat", "mentor-active"],
    queryFn: getMentorActiveChatSession,
    refetchInterval: 10_000,
  });
  const bookingsQ = useQuery({
    queryKey: ["bookings", "mentor", "me"],
    queryFn: listMentorBookings,
    refetchInterval: 15_000,
  });
  const chatInboxQ = useQuery({
    queryKey: ["chat", "sessions", "mentor", "dashboard-live"],
    queryFn: listChatSessions,
    refetchInterval: 10_000,
  });

  const liveJoin = useMemo(
    () =>
      resolveMentorLiveJoinTarget({
        activeSession: activeChatQ.data ?? null,
        bookings: bookingsQ.data ?? [],
        inbox: chatInboxQ.data?.sessions ?? [],
      }),
    [activeChatQ.data, bookingsQ.data, chatInboxQ.data?.sessions],
  );

  // Already in the chatroom — no need for the sticky bar.
  if (!liveJoin || location.pathname.includes(`/mentor/chat/${liveJoin.sessionId}`)) {
    return null;
  }

  const label = liveJoin.partnerName
    ? (liveJoin.waitingForCoach ? d.liveSessionWaiting : d.liveSessionActive).replace(
        "{name}",
        liveJoin.partnerName,
      )
    : d.liveSessionGeneric;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
      role="region"
      aria-label={d.joinLiveSession}
    >
      <div className="pointer-events-auto mx-auto flex max-w-lg flex-col gap-2 rounded-2xl border border-emerald-500/40 bg-background/95 p-3 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <p className="line-clamp-2 text-center text-xs font-medium text-muted-foreground">{label}</p>
        <Button asChild size="lg" className="gradient-cta h-12 w-full text-base text-white shadow-md">
          <Link to={liveJoin.path}>
            <Video className="mr-2 h-5 w-5" />
            {d.joinLiveSession}
          </Link>
        </Button>
      </div>
    </div>
  );
}
