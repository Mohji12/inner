import { useQuery } from "@tanstack/react-query";
import { fetchAdminPayments } from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";

export default function AdminPaymentsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", limit],
    queryFn: () => fetchAdminPayments(0, limit),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.payments}</CardTitle>
        <CardDescription>
          {data.total} total · showing {data.items.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gateway</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead>Txn id</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground">{new Date(p.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {p.amount} {p.currency}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{p.status}</Badge>
                </TableCell>
                <TableCell>{p.payment_gateway}</TableCell>
                <TableCell className="font-mono text-xs">{p.booking_id.slice(0, 8)}…</TableCell>
                <TableCell className="max-w-[140px] truncate text-xs">{p.transaction_id ?? "—"}</TableCell>
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
