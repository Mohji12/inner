import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveAdminSettlement,
  fetchAdminSettlementCandidates,
  fetchAdminSettlements,
  generateAdminSettlements,
  markAdminSettlementPaid,
  payAdminSettlement,
} from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminSettlementsPage() {
  const [cycleEnd, setCycleEnd] = useState<string>(new Date().toISOString().slice(0, 10));
  const queryClient = useQueryClient();
  const candidatesQ = useQuery({
    queryKey: ["admin", "settlement-candidates", cycleEnd],
    queryFn: () => fetchAdminSettlementCandidates(cycleEnd),
  });
  const settlementsQ = useQuery({
    queryKey: ["admin", "settlements"],
    queryFn: () => fetchAdminSettlements(0, 100),
  });

  const generateMut = useMutation({
    mutationFn: () => generateAdminSettlements({ cycle_end: cycleEnd }),
    onSuccess: () => {
      toast.success("Settlement cycle generated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "settlement-candidates"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "settlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveAdminSettlement(id),
    onSuccess: () => {
      toast.success("Settlement approved");
      void queryClient.invalidateQueries({ queryKey: ["admin", "settlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMut = useMutation({
    mutationFn: (id: string) => payAdminSettlement(id),
    onSuccess: () => {
      toast.success("Payout attempted");
      void queryClient.invalidateQueries({ queryKey: ["admin", "settlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMut = useMutation({
    mutationFn: (id: string) => markAdminSettlementPaid(id),
    onSuccess: () => {
      toast.success("Marked as paid");
      void queryClient.invalidateQueries({ queryKey: ["admin", "settlements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const candidates = candidatesQ.data?.candidates ?? [];
  const settlements = settlementsQ.data?.items ?? [];

  const totalCandidateNet = useMemo(
    () => candidates.reduce((sum, row) => sum + Number(row.net_amount), 0),
    [candidates],
  );

  return (
    <div className="space-y-6">
      <Card className="border-border/60 glass-card">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Coach Settlements</CardTitle>
          <CardDescription>15-day admin-managed settlement cycle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Cycle end date</p>
              <Input type="date" value={cycleEnd} onChange={(e) => setCycleEnd(e.target.value)} className="w-[180px]" />
            </div>
            <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
              {generateMut.isPending ? "Generating…" : "Generate cycle"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Eligible coaches: {candidates.length} · Net total: EUR {totalCandidateNet.toFixed(2)}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coach</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => (
                <TableRow key={`${c.mentor_id}-${c.currency}`}>
                  <TableCell>{c.mentor_name}</TableCell>
                  <TableCell>{c.item_count}</TableCell>
                  <TableCell>{c.gross_amount}</TableCell>
                  <TableCell>{c.fee_amount}</TableCell>
                  <TableCell>{c.net_amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/60 glass-card">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Settlement Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Mollie payout</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</TableCell>
                  <TableCell>{s.mentor_name}</TableCell>
                  <TableCell>
                    {s.cycle_start} to {s.cycle_end}
                  </TableCell>
                  <TableCell>
                    {s.net_amount} {s.currency}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    {s.connect_payout_ready === true ? (
                      <Badge variant="secondary" className="font-normal">
                        Ready
                      </Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="outline" className="font-normal text-destructive border-destructive/50">
                          Not ready
                        </Badge>
                        {s.connect_payout_blocked_reason ? (
                          <p className="text-xs text-muted-foreground leading-snug">{s.connect_payout_blocked_reason}</p>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveMut.mutate(s.id)}
                        disabled={s.status !== "pending" || approveMut.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => payMut.mutate(s.id)}
                        disabled={s.status !== "approved" || payMut.isPending || !(s.connect_payout_ready ?? false)}
                        title={
                          s.status === "approved" && !(s.connect_payout_ready ?? false)
                            ? (s.connect_payout_blocked_reason ?? "Coach must complete Mollie Connect and payout setup")
                            : undefined
                        }
                      >
                        Pay
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => markPaidMut.mutate(s.id)}
                        disabled={!["approved", "failed", "processing"].includes(s.status) || markPaidMut.isPending}
                      >
                        Mark paid
                      </Button>
                    </div>
                    {s.failure_reason ? <p className="mt-1 text-xs text-destructive">{s.failure_reason}</p> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
