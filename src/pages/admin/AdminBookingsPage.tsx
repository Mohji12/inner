import { useQuery } from "@tanstack/react-query";
import { fetchAdminBookings } from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";
import { formatDateLocal, formatTimeLocal } from "@/lib/timeZone";
import { useEffectiveTimeZone } from "@/hooks/useEffectiveTimeZone";

export default function AdminBookingsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const effectiveTimeZone = useEffectiveTimeZone();
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "bookings", limit],
    queryFn: () => fetchAdminBookings(0, limit),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.bookings}</CardTitle>
        <CardDescription>
          {d.showingCount.replace("{total}", String(data.total)).replace("{count}", String(data.items.length))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{d.date}</TableHead>
              <TableHead>{d.time}</TableHead>
              <TableHead>{d.user}</TableHead>
              <TableHead>{d.coach}</TableHead>
              <TableHead>{d.status}</TableHead>
              <TableHead>{d.payment}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  {formatDateLocal(b.start_at_utc, { year: "numeric", month: "2-digit", day: "2-digit" }, effectiveTimeZone)}
                </TableCell>
                <TableCell>
                  {formatTimeLocal(b.start_at_utc, undefined, effectiveTimeZone)}–
                  {formatTimeLocal(b.end_at_utc, undefined, effectiveTimeZone)} ({b.duration}m)
                </TableCell>
                <TableCell>{b.user_name}</TableCell>
                <TableCell>{b.mentor_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{b.status}</Badge>
                </TableCell>
                <TableCell>{b.payment_status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.items.length < data.total ? (
          <Button variant="outline" onClick={() => setLimit((l) => l + 50)}>
            {d.loadMore}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
