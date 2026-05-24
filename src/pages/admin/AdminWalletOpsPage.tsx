import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminCreditUserWallet, adminDebitUserWallet, fetchAdminWalletAnalytics } from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function AdminWalletOpsPage() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("0");
  const [reason, setReason] = useState("");
  const [lastResult, setLastResult] = useState<string>("");
  const analyticsQ = useQuery({
    queryKey: ["admin", "wallet-analytics"],
    queryFn: fetchAdminWalletAnalytics,
  });

  const creditMut = useMutation({
    mutationFn: () =>
      adminCreditUserWallet(userId.trim(), {
        amount: Number(amount),
        reason: reason.trim(),
        reference_type: "admin_adjustment",
      }),
    onSuccess: (res) => {
      setLastResult(`Credit successful. New balance: ${res.balance}`);
      toast.success("Wallet credited");
      void qc.invalidateQueries({ queryKey: ["admin", "wallet-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const debitMut = useMutation({
    mutationFn: () =>
      adminDebitUserWallet(userId.trim(), {
        amount: Number(amount),
        reason: reason.trim(),
        reference_type: "admin_adjustment",
      }),
    onSuccess: (res) => {
      setLastResult(`Debit successful. New balance: ${res.balance}`);
      toast.success("Wallet debited");
      void qc.invalidateQueries({ queryKey: ["admin", "wallet-analytics"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = userId.trim().length > 0 && Number(amount) > 0 && reason.trim().length > 0;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 glass-card max-w-2xl">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Admin Wallet Operations</CardTitle>
          <CardDescription>Credit/debit a user wallet with audit reason.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="uid">User ID</Label>
              <Input id="uid" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amt">Amount</Label>
              <Input id="amt" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={!valid || creditMut.isPending} onClick={() => creditMut.mutate()}>
                Credit
              </Button>
              <Button type="button" variant="outline" disabled={!valid || debitMut.isPending} onClick={() => debitMut.mutate()}>
                Debit
              </Button>
            </div>
            {lastResult ? <p className="text-sm text-muted-foreground">{lastResult}</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/60 glass-card">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Wallet Analytics (Admin Adjustments)</CardTitle>
          <CardDescription>
            Total credited: {analyticsQ.data?.total_credited ?? "0.00"} | Total debited: {analyticsQ.data?.total_debited ?? "0.00"} | Net: {analyticsQ.data?.total_net ?? "0.00"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading analytics...</p>
          ) : !analyticsQ.data || analyticsQ.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet adjustment data yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Credited</TableHead>
                  <TableHead>Debited</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyticsQ.data.items.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell className="font-mono text-xs">{row.user_id}</TableCell>
                    <TableCell>{row.user_name}</TableCell>
                    <TableCell>{row.user_email}</TableCell>
                    <TableCell>{row.credited_total} {row.currency}</TableCell>
                    <TableCell>{row.debited_total} {row.currency}</TableCell>
                    <TableCell>{row.net_total} {row.currency}</TableCell>
                    <TableCell>{row.transaction_count}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.last_transaction_at ? new Date(row.last_transaction_at).toLocaleString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
