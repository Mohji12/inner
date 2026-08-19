import { useQuery } from "@tanstack/react-query";
import { getAdminMe } from "@/api/admin";
import { getMentorMe } from "@/api/mentors";
import { getUserMe } from "@/api/users";
import { useAuth } from "@/auth/AuthContext";
import { personDisplayName } from "@/lib/personName";

/** Signed-in person's name for user, coach, and admin dashboards. */
export function useDashboardPerson(fallback: string): string {
  const { role } = useAuth();
  const userQ = useQuery({
    queryKey: ["users", "me"],
    queryFn: getUserMe,
    enabled: role === "user",
  });
  const mentorQ = useQuery({
    queryKey: ["mentors", "me"],
    queryFn: getMentorMe,
    enabled: role === "mentor",
  });
  const adminQ = useQuery({
    queryKey: ["admin", "me"],
    queryFn: getAdminMe,
    enabled: role === "admin",
  });
  const raw =
    role === "user"
      ? userQ.data?.full_name
      : role === "mentor"
        ? mentorQ.data?.full_name
        : adminQ.data?.full_name;
  return personDisplayName(raw, fallback);
}
