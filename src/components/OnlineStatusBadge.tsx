import { useQuery } from "@tanstack/react-query";
import { getMentorPresenceStatus } from "@/api/mentors";
import { getUserPresenceStatus } from "@/api/users";
import { useAuth } from "@/auth/AuthContext";
import { PresenceIndicator, type PresenceStatus } from "@/components/PresenceIndicator";

export function OnlineStatusBadge() {
  const { role } = useAuth();

  const mentorQuery = useQuery({
    queryKey: ["mentor", "presence-status"],
    queryFn: getMentorPresenceStatus,
    enabled: role === "mentor",
    refetchInterval: 15_000,
  });

  const userQuery = useQuery({
    queryKey: ["user", "presence-status"],
    queryFn: getUserPresenceStatus,
    enabled: role === "user",
    refetchInterval: 15_000,
  });

  if (role === "mentor" && mentorQuery.data) {
    const status = mentorQuery.data.status as PresenceStatus;
    return <PresenceIndicator status={status} showLabel />;
  }

  if (role === "user" && userQuery.data) {
    const status: PresenceStatus = userQuery.data.is_online ? "online" : "offline";
    return <PresenceIndicator status={status} showLabel />;
  }

  return null;
}
