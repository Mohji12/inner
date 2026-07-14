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
import { useLanguage } from "@/i18n/LanguageContext";
import { marketplaceStatusTone, titleizeMarketplaceStatus } from "@/lib/marketplaceStatus";

export default function AdminMarketplacePage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
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
      toast.success(d.successGeneric);
      void queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "commission"] });
    },
    onError: (e: Error) => toast.error(e.message || d.errorGeneric),
  });

  const capabilityMut = useMutation({
    mutationFn: () => upsertAdminMarketplaceCapability(capability),
    onSuccess: () => {
      toast.success(d.successGeneric);
      void queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "capabilities"] });
    },
    onError: (e: Error) => toast.error(e.message || d.errorGeneric),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveAdminMarketplacePayout(id),
    onSuccess: () => {
      toast.success(d.successGeneric);
      void queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "payouts"] });
    },
    onError: (e: Error) => toast.error(e.message || d.errorGeneric),
  });

  const executeMut = useMutation({
    mutationFn: (id: string) => executeAdminMarketplacePayout(id),
    onSuccess: () => {
      toast.success(d.successGeneric);
      void queryClient.invalidateQueries({ queryKey: ["admin", "marketplace", "payouts"] });
    },
    onError: (e: Error) => toast.error(e.message || d.errorGeneric),
  });

  const releaseMut = useMutation({
    mutationFn: ({ mentorId, amount }: { mentorId: string; amount: number }) =>
      releaseAdminCoachPendingToWithdrawable(mentorId, amount, "EUR"),
    onSuccess: () => {
      toast.success(d.successGeneric);
    },
    onError: (e: Error) => toast.error(e.message || d.errorGeneric),
  });

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{d.marketplaceTitle}</CardTitle>
          <CardDescription>{d.marketplace}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {d.amount}: {commissionQ.data?.percent ?? "—"} {commissionQ.data?.currency ?? "EUR"}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{d.amount}</p>
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
              {commissionMut.isPending ? d.tableLoading : d.saveChanges}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{d.marketplaceTitle}</CardTitle>
          <CardDescription>{d.marketplace}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder={d.country}
              value={capability.country_code}
              onChange={(e) => setCapability((p) => ({ ...p, country_code: e.target.value.toUpperCase() }))}
            />
            <Input
              placeholder={d.type}
              value={capability.entity_type}
              onChange={(e) => setCapability((p) => ({ ...p, entity_type: e.target.value }))}
            />
            <Input
              placeholder={d.currency}
              value={capability.currency}
              onChange={(e) => setCapability((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
            />
          </div>
          <Input
            placeholder={d.note}
            value={capability.notes}
            onChange={(e) => setCapability((p) => ({ ...p, notes: e.target.value }))}
          />
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <Switch
                checked={capability.supports_connect}
                onCheckedChange={(v) => setCapability((p) => ({ ...p, supports_connect: v }))}
              />
              {d.provider}
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={capability.supports_payouts}
                onCheckedChange={(v) => setCapability((p) => ({ ...p, supports_payouts: v }))}
              />
              {d.payments}
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={capability.supports_transfers}
                onCheckedChange={(v) => setCapability((p) => ({ ...p, supports_transfers: v }))}
              />
              {d.transactionsTitle}
            </label>
          </div>
          <Button onClick={() => capabilityMut.mutate()} disabled={capabilityMut.isPending}>
            {capabilityMut.isPending ? d.tableLoading : d.submit}
          </Button>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.country}</TableHead>
                <TableHead>{d.type}</TableHead>
                <TableHead>{d.currency}</TableHead>
                <TableHead>{d.provider}</TableHead>
                <TableHead>{d.payments}</TableHead>
                <TableHead>{d.transactionsTitle}</TableHead>
                <TableHead>{d.updated}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(capabilitiesQ.data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.country_code}</TableCell>
                  <TableCell>{r.entity_type}</TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell>{r.supports_connect ? d.yes : d.no}</TableCell>
                  <TableCell>{r.supports_payouts ? d.yes : d.no}</TableCell>
                  <TableCell>{r.supports_transfers ? d.yes : d.no}</TableCell>
                  <TableCell>{new Date(r.updated_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{d.marketplaceTitle}</CardTitle>
          <CardDescription>{d.approvePayout}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.created}</TableHead>
                <TableHead>{d.coach}</TableHead>
                <TableHead>{d.amount}</TableHead>
                <TableHead>{d.status}</TableHead>
                <TableHead>{d.credit}</TableHead>
                <TableHead className="text-right">{d.actions}</TableHead>
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
                        {d.submit}
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
                        {d.approvePayout}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => executeMut.mutate(p.id)}
                        disabled={!["approved", "failed"].includes(p.status) || executeMut.isPending}
                      >
                        {d.payNow}
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
