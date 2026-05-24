import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { getMentorMe } from "@/api/mentors";
import { getUserMe } from "@/api/users";
import { resolveBrowserTimeZone } from "@/lib/timeZone";

export function useEffectiveTimeZone(): string {
  const { role, userAccessToken, mentorAccessToken } = useAuth();
  const browserTz = resolveBrowserTimeZone();

  const userQuery = useQuery({
    queryKey: ["users", "me", "timezone"],
    queryFn: getUserMe,
    enabled: role === "user" && Boolean(userAccessToken),
    staleTime: 60_000,
  });

  const mentorQuery = useQuery({
    queryKey: ["mentors", "me", "timezone"],
    queryFn: getMentorMe,
    enabled: role === "mentor" && Boolean(mentorAccessToken),
    staleTime: 60_000,
  });

  if (role === "user") {
    return userQuery.data?.timezone?.trim() || browserTz;
  }

  if (role === "mentor") {
    const maybeMentorTimezone = (mentorQuery.data as { timezone?: string | null } | undefined)?.timezone;
    return maybeMentorTimezone?.trim() || browserTz;
  }

  return browserTz;
}

