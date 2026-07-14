import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Link2 } from "lucide-react";
import { toast } from "sonner";

import { getCoachConnectStatus, refreshCoachConnectStatus, startCoachConnectOnboarding } from "@/api/mentors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { marketplaceStatusTone, titleizeMarketplaceStatus } from "@/lib/marketplaceStatus";

export function CoachConnectStatusCard() {
  const { t } = useLanguage();
  const m = t.app.mollieConnect;
  const queryClient = useQueryClient();
  const connectStatusQ = useQuery({
    queryKey: ["mentor", "marketplace", "connect-status"],
    queryFn: getCoachConnectStatus,
  });

  const connectStartMut = useMutation({
    mutationFn: startCoachConnectOnboarding,
    onSuccess: (out) => {
      window.open(out.onboarding_url, "_blank", "noopener,noreferrer");
      toast.message(m.toastOpenedTitle, {
        description: m.toastOpenedBody,
        duration: 12_000,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refreshMut = useMutation({
    mutationFn: refreshCoachConnectStatus,
    onSuccess: (data) => {
      queryClient.setQueryData(["mentor", "marketplace", "connect-status"], data);
      if (data.mollie_balance_note && (data.mollie_settlement_available == null || data.mollie_settlement_available === "")) {
        toast.message(m.toastBalanceTitle, { description: data.mollie_balance_note });
      } else {
        toast.success(m.toastStatusUpdated);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const state = connectStatusQ.data?.onboarding_state ?? "not_started";
  const kyc = connectStatusQ.data?.kyc_status ?? "pending";
  const payoutsEnabled = connectStatusQ.data?.payouts_enabled ?? false;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          {m.statusLabel}
        </CardDescription>
        <CardTitle className="font-serif text-2xl">{m.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Alert className="border-border/80 bg-muted/40">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm">{m.noAccountTitle}</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">{m.noAccountBody}</AlertDescription>
        </Alert>
        <p className="text-muted-foreground">{m.optionalBlurb}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={marketplaceStatusTone(state)}>
            {m.onboardingPrefix}: {titleizeMarketplaceStatus(state)}
          </Badge>
          <Badge variant={marketplaceStatusTone(kyc)}>
            {m.kycPrefix}: {titleizeMarketplaceStatus(kyc)}
          </Badge>
          <Badge variant={marketplaceStatusTone(payoutsEnabled ? "enabled" : "disabled")}>
            {m.payoutsPrefix}: {payoutsEnabled ? m.payoutsEnabled : m.payoutsDisabled}
          </Badge>
        </div>
        {connectStatusQ.data?.provider_account_label || connectStatusQ.data?.provider_account_masked ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{m.destinationTitle}</p>
            {connectStatusQ.data?.provider_account_label ? (
              <p>
                {m.accountLabel}: {connectStatusQ.data.provider_account_label}
              </p>
            ) : null}
            {connectStatusQ.data?.provider_account_masked ? (
              <p>
                {m.bankRefLabel}: {connectStatusQ.data.provider_account_masked}
              </p>
            ) : null}
          </div>
        ) : null}
        {connectStatusQ.data?.mollie_settlement_available != null && connectStatusQ.data.mollie_settlement_available !== "" ? (
          <p className="text-muted-foreground">
            {m.settlementAvailable.replace("{amount}", String(connectStatusQ.data.mollie_settlement_available))}
          </p>
        ) : null}
        {connectStatusQ.data?.mollie_balance_note ? (
          <p className="text-xs text-muted-foreground">{connectStatusQ.data.mollie_balance_note}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => connectStartMut.mutate()} disabled={connectStartMut.isPending}>
            {connectStartMut.isPending ? m.opening : m.startSetup}
          </Button>
          {connectStatusQ.data?.mollie_onboarding_dashboard_url ? (
            <Button type="button" size="sm" variant="default" asChild>
              <a
                href={connectStatusQ.data.mollie_onboarding_dashboard_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {m.continueVerification}
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
          >
            {refreshMut.isPending ? m.refreshing : m.refreshStatus}
          </Button>
        </div>
        {!payoutsEnabled && !connectStatusQ.data?.mollie_onboarding_dashboard_url && state !== "not_started" ? (
          <p className="text-xs text-muted-foreground">{m.refreshHint}</p>
        ) : null}
        {connectStatusQ.isError ? <p className="text-destructive">{m.loadError}</p> : null}
      </CardContent>
    </Card>
  );
}
