import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { getPlatformPricing, listMentors } from "@/api/mentors";
import { MentorBrowseCard } from "@/components/MentorBrowseCard";

const UserMentorsBrowsePage = () => {
  const { userAccessToken } = useAuth();
  const { t } = useLanguage();
  const p = t.app.mentorsPage;

  const { data: mentors = [], isLoading } = useQuery({
    queryKey: ["mentors", "public"],
    queryFn: () => listMentors(true),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: pricing } = useQuery({
    queryKey: ["platform-pricing"],
    queryFn: getPlatformPricing,
  });

  if (isLoading) {
    return <p className="text-muted-foreground animate-pulse">{p.loading}</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">{p.directory}</p>
        <h1 className="font-serif text-3xl">{p.heading}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{p.sub}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {mentors.map((mentor) => (
          <MentorBrowseCard
            key={mentor.id}
            mentor={mentor}
            pricing={pricing}
            viewProfileLabel={p.viewProfile}
            consultNowLabel={p.consultNow}
          />
        ))}
      </div>

      {!userAccessToken ? (
        <p className="text-sm text-muted-foreground">
          <Link to="/register" className="text-accent underline-offset-4 hover:underline">
            Register
          </Link>{" "}
          or{" "}
          <Link to="/login?role=user" className="text-accent underline-offset-4 hover:underline">
            log in
          </Link>{" "}
          to book a slot.
        </p>
      ) : null}
    </div>
  );
};

export default UserMentorsBrowsePage;
