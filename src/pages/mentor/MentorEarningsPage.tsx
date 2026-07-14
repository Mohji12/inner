import { useQuery } from "@tanstack/react-query";
import { getMentorEarnings } from "@/api/mentors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";

const MentorEarningsPage = () => {
  const { t } = useLanguage();
  const m = t.app.mentorEarnings;
  const { data, isLoading } = useQuery({
    queryKey: ["mentor", "earnings"],
    queryFn: getMentorEarnings,
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{m.loading}</p>;
  }

  const currency = data?.currency ?? "EUR";

  return (
    <Card className="max-w-lg border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-3xl">{m.title}</CardTitle>
        <CardDescription>{m.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-lg">
        <p>
          <span className="text-muted-foreground">{m.total.replace("{currency}", currency)}: </span>
          <span className="font-semibold">{data?.total_amount ?? "0.00"}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {m.payments.replace("{count}", String(data?.payment_count ?? 0))}
        </p>
      </CardContent>
    </Card>
  );
};

export default MentorEarningsPage;
