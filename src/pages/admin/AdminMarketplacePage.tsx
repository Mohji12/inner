import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  approveAdminMarketplacePayout,
  executeAdminMarketplacePayout,
  getAdminMarketplaceCommission,
  listAdminMarketplaceCapabilities,
  listAdminMarketplacePayoutRequests,
  releaseAdminCoachPendingToWithdrawable,
  updateAdminMarketplaceCommission,
  upsertAdminMarketplaceCapability,
} from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { marketplaceStatusTone, titleizeMarketplaceStatus } from "@/lib/marketplaceStatus";

export default function AdminMarketplacePage() {
  const queryClient = useQueryClient();
  const [commissionPct, setCommissionPct] = useState("20");
  const [capability, setCapability] = useState({
    country_code: "NL",
    entity_type: "individual",
    currency: "EUR",
    supports_connect: true,
    supports_payouts: true,
    supports_transfers: true,
    notes: "",
  });
  const [releaseByMentor, setReleaseByMentor] = useState<Record<string, string>>({});

  const commissionQ = useQuery({
    queryKey: ["admin", "marketplace", "commission"],
    queryFn: () => getAdminMarketplaceCommission("EUR"),
  });
  const capabilitiesQ = useQuery({
    queryKey: ["admin", "marketplace", "capabilities"],
    queryFn: listAdminMarketplaceCapabilities,
  });
  const payoutsQ = useQuery({
    queryKey: ["admin", "marketplace", "payouts"],
    queryFn: () => listAdminMarketplacePayoutRequests(),
  });

  const sortedPayouts = useMemo(
    () => [...(payoutsQ.data ?? [])].sort((a, b) => b.requested_at.localeCompare(a.requested_at)),
    [payoutsQ.data],
  );

  const commissionMut = useMutation({
    mutationFn: () =>
      updateAdminMarketplaceCommission({
        percent: Number(commissionPct),
        currency: "EUR",
      }),
    onSuccess: () => {
      toast.success("Commission updated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "commission"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const capabilityMut = useMutation({
    mutationFn: () => upsertAdminMarketplaceCapability(capability),
    onSuccess: () => {
      toast.success("Capability updated");
      void queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "capabilities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveAdminMarketplacePayout(id),
    onSuccess: () => {
      toast.success("Payout approved");
      void queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const executeMut = useMutation({
    mutationFn: (id: string) => executeAdminMarketplacePayout(id),
    onSuccess: () => {
      toast.success("Payout execution requested");
      void queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMut = useMutation({
    mutationFn: ({ mentorId, amount }: { mentorId: string; amount: number }) =>
      releaseAdminCoachPendingToWithdrawable(mentorId, amount, "EUR"),
    onSuccess: () => {
      toast.success("Released coach pending balance");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Marketplace commission</CardTitle>
          <CardDescription>Global commission settings for coach payouts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Current: {commissionQ.data?.percent ?? "-"} {commissionQ.data?.currency ?? "EUR"}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Commission %</p>
              <Input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                className="w-[180px]"
                value={commissionPct}
                onChange={(e) => setCommissionPct(e.target.value)}
              />
            </div>
            <Button onClick={() => commissionMut.mutate()} disabled={commissionMut.isPending}>
              {commissionMut.isPending ? "Saving..." : "Update commission"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Capability matrix</CardTitle>
          <CardDescription>Country/entity payout and transfer support controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Country code"
              value={capability.country_code}
              onChange={(e) => setCapability((p) => ({ ...p, country_code: e.target.value.toUpperCase() }))}
            />
            <Input
              placeholder="Entity type"
              value={capability.entity_type}
              onChange={(e) => setCapability((p) => ({ ...p, entity_type: e.target.value }))}
            />
            <Input
              placeholder="Currency"
              value={capability.currency}
              onChange={(e) => setCapability((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
            />
          </div>
          <Input
            placeholder="Notes"
            value={capability.notes}
            onChange={(e) => setCapability((p) => ({ ...p, notes: e.target.value }))}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Switch
                checked={capability.supports_connect}
                onCheckedChange={(v) => setCapability((p) => ({ ...p, supports_connect: v }))}
              />
              Connect
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={capability.supports_payouts}
                onCheckedChange={(v) => setCapability((p) => ({ ...p, supports_payouts: v }))}
              />
              Payouts
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={capability.supports_transfers}
                onCheckedChange={(v) => setCapability((p) => ({ ...p, supports_transfers: v }))}
              />
              Transfers
            </label>
          </div>
          <Button onClick={() => capabilityMut.mutate()} disabled={capabilityMut.isPending}>
            {capabilityMut.isPending ? "Saving..." : "Upsert capability"}
          </Button>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Connect</TableHead>
                <TableHead>Payouts</TableHead>
                <TableHead>Transfers</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(capabilitiesQ.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.country_code}</TableCell>
                  <TableCell>{r.entity_type}</TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell>{r.supports_connect ? "Yes" : "No"}</TableCell>
                  <TableCell>{r.supports_payouts ? "Yes" : "No"}</TableCell>
                  <TableCell>{r.supports_transfers ? "Yes" : "No"}</TableCell>
                  <TableCell>{new Date(r.updated_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Payout approvals & execution</CardTitle>
          <CardDescription>Approve and execute coach payout requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Release pending</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPayouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.requested_at).toLocaleString()}</TableCell>
                  <TableCell>{p.mentor_id}</TableCell>
                  <TableCell>
                    {p.currency} {p.amount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={marketplaceStatusTone(p.status)}>{titleizeMarketplaceStatus(p.status)}</Badge>
                    {p.failure_reason ? <p className="mt-1 text-xs text-destructive">{p.failure_reason}</p> : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="w-[110px]"
                        value={releaseByMentor[p.mentor_id] ?? ""}
                        onChange={(e) =>
                          setReleaseByMentor((prev) => ({
                            ...prev,
                            [p.mentor_id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          releaseMut.mutate({
                            mentorId: p.mentor_id,
                            amount: Number(releaseByMentor[p.mentor_id] || "0"),
                          })
                        }
                        disabled={releaseMut.isPending || !(Number(releaseByMentor[p.mentor_id] || "0") > 0)}
                      >
                        Release
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveMut.mutate(p.id)}
                        disabled={!["requested", "failed"].includes(p.status) || approveMut.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => executeMut.mutate(p.id)}
                        disabled={!["approved", "failed"].includes(p.status) || executeMut.isPending}
                      >
                        Execute
                      </Button>
                    </div>
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
