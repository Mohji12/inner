import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getMentorPayoutBankDetails,
  saveMentorPayoutBankDetails,
} from "@/api/mentors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import { marketplaceStatusTone, titleizeMarketplaceStatus } from "@/lib/marketplaceStatus";

export function CoachBankTransferDetailsCard() {
  const { t } = useLanguage();
  const m = t.app.coachBankTransfer;
  const queryClient = useQueryClient();
  const [holder, setHolder] = useState("");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");

  const detailsQ = useQuery({
    queryKey: ["mentor", "payout-bank-details"],
    queryFn: getMentorPayoutBankDetails,
  });

  useEffect(() => {
    const d = detailsQ.data;
    if (!d?.has_bank_details) return;
    if (d.account_holder_name) setHolder(d.account_holder_name);
  }, [detailsQ.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveMentorPayoutBankDetails({
        account_holder_name: holder.trim(),
        iban: iban.trim(),
        bic: bic.trim() || null,
      }),
    onSuccess: (out) => {
      toast.success(m.toastSaved);
      void queryClient.setQueryData(["mentor", "payout-bank-details"], out);
      setIban("");
      setBic("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const existing = detailsQ.data;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{m.title}</CardTitle>
        <CardDescription>{m.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {detailsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">{m.loading}</p>
        ) : existing?.has_bank_details ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{m.status}</span>
              <Badge variant={marketplaceStatusTone(existing.status)}>
                {titleizeMarketplaceStatus(existing.status)}
              </Badge>
            </div>
            <p>
              <span className="text-muted-foreground">{m.accountHolder}</span>
              <br />
              <span className="font-medium">{existing.account_holder_name ?? "—"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{m.iban}</span>
              <br />
              <span className="font-mono">{existing.iban_masked ?? "—"}</span>
            </p>
            {existing.bic_masked ? (
              <p>
                <span className="text-muted-foreground">{m.bic}</span>
                <br />
                <span className="font-mono">{existing.bic_masked}</span>
              </p>
            ) : null}
            {existing.updated_at ? (
              <p className="text-xs text-muted-foreground">
                {m.lastUpdated.replace("{date}", new Date(existing.updated_at).toLocaleString())}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">{m.securityNote}</p>
          </div>
        ) : null}

        <div className="space-y-3 max-w-md">
          <div className="space-y-1">
            <Label htmlFor="bt-holder">{m.holderLabel}</Label>
            <Input
              id="bt-holder"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              autoComplete="name"
              placeholder={m.holderPlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bt-iban">{m.iban}</Label>
            <Input
              id="bt-iban"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={existing?.has_bank_details ? m.ibanUpdatePlaceholder : m.ibanPlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bt-bic">{m.bicLabel}</Label>
            <Input
              id="bt-bic"
              value={bic}
              onChange={(e) => setBic(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={m.bicPlaceholder}
            />
          </div>
          <Button
            type="button"
            disabled={saveMut.isPending || !holder.trim() || !iban.trim()}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? m.saving : existing?.has_bank_details ? m.update : m.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
