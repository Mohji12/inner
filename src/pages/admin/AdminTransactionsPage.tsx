import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminTransactions } from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";

export default function AdminTransactionsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [limit, setLimit] = useState(100);

  const typeLabels: Record<string, string> = {
    booking_payment: d.booking,
    chat_purchase: d.chatInvoices,
    onboarding_payment: d.type,
    wallet_credit: d.credit,
    wallet_debit: d.debit,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "transactions", limit],
    queryFn: () => fetchAdminTransactions(0, limit),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.transactionsTitle}</CardTitle>
        <CardDescription>
          {d.showingCount.replace("{total}", String(data.total)).replace("{count}", String(data.items.length))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{d.type}</TableHead>
              <TableHead>{d.name}</TableHead>
              <TableHead>{d.email}</TableHead>
              <TableHead>{d.amount}</TableHead>
              <TableHead>{d.status}</TableHead>
              <TableHead>{d.txnId}</TableHead>
              <TableHead>{d.date}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => (
              <TableRow key={`${row.transaction_type}-${row.id}`}>
                <TableCell>
                  <Badge variant="secondary">{typeLabels[row.transaction_type] ?? row.transaction_type}</Badge>
                </TableCell>
                <TableCell>{row.party_name}</TableCell>
                <TableCell className="text-muted-foreground">{row.party_email ?? "—"}</TableCell>
                <TableCell>
                  {row.currency} {row.amount}
                </TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell className="max-w-[120px] truncate font-mono text-xs">{row.reference_id ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(row.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.items.length < data.total ? (
          <Button variant="outline" onClick={() => setLimit((l) => l + 100)}>
            {d.loadMore}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
