import { useQuery } from "@tanstack/react-query";
import { getMentorEarnings } from "@/api/mentors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const MentorEarningsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["mentor", "earnings"],
    queryFn: getMentorEarnings,
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Loading earnings…</p>;
  }

  return (
    <Card className="max-w-lg border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-3xl">Earnings</CardTitle>
        <CardDescription>Successful placeholder payments linked to your bookings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-lg">
        <p>
          <span className="text-muted-foreground">Total ({data?.currency ?? "EUR"}): </span>
          <span className="font-semibold">{data?.total_amount ?? "0.00"}</span>
        </p>
        <p className="text-sm text-muted-foreground">{data?.payment_count ?? 0} payments</p>
      </CardContent>
    </Card>
  );
};

export default MentorEarningsPage;
