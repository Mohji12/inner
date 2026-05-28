import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminTransactions } from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TYPE_LABELS: Record<string, string> = {
  booking_payment: "Booking",
  chat_purchase: "Chat",
  onboarding_payment: "Onboarding",
  wallet_credit: "Wallet credit",
  wallet_debit: "Wallet debit",
};

export default function AdminTransactionsPage() {
  const [limit, setLimit] = useState(100);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "transactions", limit],
    queryFn: () => fetchAdminTransactions(0, limit),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Loading transactions…</p>;
  }

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">All transactions</CardTitle>
        <CardDescription>
          Booking payments, chat purchases, onboarding fees, and wallet movements · {data.total} total
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => (
              <TableRow key={`${row.transaction_type}-${row.id}`}>
                <TableCell>
                  <Badge variant="secondary">{TYPE_LABELS[row.transaction_type] ?? row.transaction_type}</Badge>
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
            Load more
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
