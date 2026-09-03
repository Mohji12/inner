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
import { useLanguage } from "@/i18n/LanguageContext";
import { marketplaceStatusTone, titleizeMarketplaceStatus } from "@/lib/marketplaceStatus";

export default function MentorPayoutsPage() {
  const { t } = useLanguage();
  const m = t.app.mentorPayouts;
  const common = t.app.common;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [amount, setAmount] = useState("10.00");

  useEffect(() => {
    const c = searchParams.get("connect");
    if (!c) return;
    if (c === "success") {
      toast.success(m.toastConnectSuccess);
    } else if (c === "failed") {
      const reason = searchParams.get("reason");
      toast.error(reason ? m.toastConnectFailedReason.replace("{reason}", reason) : m.toastConnectFailed);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("connect");
    next.delete("reason");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, m]);

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
      toast.success(m.toastRequested);
      void queryClient.invalidateQueries({ queryKey: ["mentor", "marketplace", "wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["mentor", "marketplace", "payout-requests"] });
      setAmount("10.00");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onRequest = () => {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error(m.toastInvalidAmount);
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
          <CardTitle className="font-serif text-2xl">{m.title}</CardTitle>
          <CardDescription>
            <strong className="text-foreground">{m.descriptionLead}</strong> {m.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 p-3 text-sm">
              <p className="text-muted-foreground">{m.pendingBalance}</p>
              <p className="text-lg font-semibold">
                {walletQ.data?.currency ?? "EUR"} {walletQ.data?.pending_balance ?? "0.00"}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 p-3 text-sm">
              <p className="text-muted-foreground">{m.withdrawableBalance}</p>
              <p className="text-lg font-semibold">
                {walletQ.data?.currency ?? "EUR"} {walletQ.data?.withdrawable_balance ?? "0.00"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{m.withdrawalAmount}</p>
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
              {requestMut.isPending ? m.requesting : m.requestPayout}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{m.historyTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">{common.loading}</p>
          ) : (payoutsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.emptyHistory}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.colRequested}</TableHead>
                  <TableHead>{m.colAmount}</TableHead>
                  <TableHead>{m.colStatus}</TableHead>
                  <TableHead>{m.colProcessed}</TableHead>
                  <TableHead>{m.colFailure}</TableHead>
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
