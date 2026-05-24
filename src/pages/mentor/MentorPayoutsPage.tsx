import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { createCoachPayoutRequest, getCoachWalletBalances, listCoachPayoutRequests } from "@/api/mentors";
import { CoachBankTransferDetailsCard } from "@/components/mentor/CoachBankTransferDetailsCard";
import { CoachConnectStatusCard } from "@/components/mentor/CoachConnectStatusCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { marketplaceStatusTone, titleizeMarketplaceStatus } from "@/lib/marketplaceStatus";

export default function MentorPayoutsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [amount, setAmount] = useState("10.00");

  useEffect(() => {
    const c = searchParams.get("connect");
    if (!c) return;
    if (c === "success") {
      toast.success('Mollie account linked. Use "Refresh status" after KYC if payouts stay disabled.');
    } else if (c === "failed") {
      const reason = searchParams.get("reason");
      toast.error(reason ? `Connect failed: ${reason}` : "Mollie Connect did not complete.");
    }
    const next = new URLSearchParams(searchParams);
    next.delete("connect");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const walletQ = useQuery({
    queryKey: ["mentor", "marketplace", "wallet"],
    queryFn: () => getCoachWalletBalances("EUR"),
  });

  const payoutsQ = useQuery({
    queryKey: ["mentor", "marketplace", "payout-requests"],
    queryFn: listCoachPayoutRequests,
  });

  const requestMut = useMutation({
    mutationFn: (amt: number) =>
      createCoachPayoutRequest({
        amount: amt,
        currency: "EUR",
        idempotency_key: `mentor-payout-${Date.now()}`,
      }),
    onSuccess: () => {
      toast.success("Payout request submitted");
      void queryClient.invalidateQueries({ queryKey: ["mentor", "marketplace", "wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["mentor", "marketplace", "payout-requests"] });
      setAmount("10.00");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onRequest = () => {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    requestMut.mutate(v);
  };

  return (
    <div className="space-y-6">
      <CoachBankTransferDetailsCard />
      <CoachConnectStatusCard />
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Payouts</CardTitle>
          <CardDescription>
            <strong className="text-foreground">No Mollie account?</strong> You can still get paid: add your bank
            details in the first section so the platform can transfer your share manually. Mollie below is only needed
            if you want automated withdrawals from your in-app wallet to your own bank via Mollie Connect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 p-3 text-sm">
              <p className="text-muted-foreground">Pending balance</p>
              <p className="text-lg font-semibold">
                {walletQ.data?.currency ?? "EUR"} {walletQ.data?.pending_balance ?? "0.00"}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-3 text-sm">
              <p className="text-muted-foreground">Withdrawable balance</p>
              <p className="text-lg font-semibold">
                {walletQ.data?.currency ?? "EUR"} {walletQ.data?.withdrawable_balance ?? "0.00"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Withdrawal amount (EUR)</p>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <Button type="button" onClick={onRequest} disabled={requestMut.isPending}>
              {requestMut.isPending ? "Requesting..." : "Request payout"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Payout history</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (payoutsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No payout requests yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Failure</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payoutsQ.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.requested_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {row.currency} {row.amount}
                    </TableCell>
                    <TableCell>
                      <Badge variant={marketplaceStatusTone(row.status)}>{titleizeMarketplaceStatus(row.status)}</Badge>
                    </TableCell>
                    <TableCell>{row.processed_at ? new Date(row.processed_at).toLocaleString() : "-"}</TableCell>
                    <TableCell className="text-destructive">{row.failure_reason ?? "-"}</TableCell>
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
