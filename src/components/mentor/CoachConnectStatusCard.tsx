import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Link2 } from "lucide-react";
import { toast } from "sonner";

import { getCoachConnectStatus, refreshCoachConnectStatus, startCoachConnectOnboarding } from "@/api/mentors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { marketplaceStatusTone, titleizeMarketplaceStatus } from "@/lib/marketplaceStatus";

export function CoachConnectStatusCard() {
  const queryClient = useQueryClient();
  const connectStatusQ = useQuery({
    queryKey: ["mentor", "marketplace", "connect-status"],
    queryFn: getCoachConnectStatus,
  });

  const connectStartMut = useMutation({
    mutationFn: startCoachConnectOnboarding,
    onSuccess: (out) => {
      window.open(out.onboarding_url, "_blank", "noopener,noreferrer");
      toast.message("Mollie opened in a new tab", {
        description:
          "You do not need an existing Mollie login. On Mollie’s page use Create account / Register to set up a free organisation, then continue to link payouts to this platform.",
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
        toast.message("Mollie balance", { description: data.mollie_balance_note });
      } else {
        toast.success("Connect status updated");
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
          Connect status
        </CardDescription>
        <CardTitle className="font-serif text-2xl">Mollie Connect (optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Alert className="border-border/80 bg-muted/40">
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm">No Mollie account yet?</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            The first button opens Mollie&apos;s secure site. That page may look like a login screen — use{" "}
            <strong className="text-foreground">Create account</strong> or <strong className="text-foreground">Register</strong>{" "}
            there if you have never used Mollie. After your organisation exists, you can add your payout bank in
            Mollie&apos;s onboarding. If you only want the platform to pay you by bank transfer without Mollie, skip this
            section and fill in <strong className="text-foreground">Bank details for your share</strong> below instead.
          </AlertDescription>
        </Alert>
        <p className="text-muted-foreground">
          <strong className="text-foreground">Optional — automated wallet payouts:</strong> linking Mollie lets
          approved withdrawals from your platform wallet go to the bank account you verify in Mollie.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={marketplaceStatusTone(state)}>Onboarding: {titleizeMarketplaceStatus(state)}</Badge>
          <Badge variant={marketplaceStatusTone(kyc)}>KYC: {titleizeMarketplaceStatus(kyc)}</Badge>
          <Badge variant={marketplaceStatusTone(payoutsEnabled ? "enabled" : "disabled")}>
            Payouts: {payoutsEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        {connectStatusQ.data?.provider_account_label || connectStatusQ.data?.provider_account_masked ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Payout destination (from Mollie)</p>
            {connectStatusQ.data?.provider_account_label ? (
              <p>
                Account: {connectStatusQ.data.provider_account_label}
              </p>
            ) : null}
            {connectStatusQ.data?.provider_account_masked ? (
              <p>
                Bank reference: {connectStatusQ.data.provider_account_masked}
              </p>
            ) : null}
          </div>
        ) : null}
        {connectStatusQ.data?.mollie_settlement_available != null && connectStatusQ.data.mollie_settlement_available !== "" ? (
          <p className="text-muted-foreground">
            Mollie settlement available (app default currency): EUR {connectStatusQ.data.mollie_settlement_available}
          </p>
        ) : null}
        {connectStatusQ.data?.mollie_balance_note ? (
          <p className="text-xs text-muted-foreground">{connectStatusQ.data.mollie_balance_note}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => connectStartMut.mutate()} disabled={connectStartMut.isPending}>
            {connectStartMut.isPending ? "Opening…" : "Start Mollie payout setup"}
          </Button>
          {connectStatusQ.data?.mollie_onboarding_dashboard_url ? (
            <Button type="button" size="sm" variant="default" asChild>
              <a
                href={connectStatusQ.data.mollie_onboarding_dashboard_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Continue bank & verification in Mollie
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
            {refreshMut.isPending ? "Refreshing..." : "Refresh status"}
          </Button>
        </div>
        {!payoutsEnabled && !connectStatusQ.data?.mollie_onboarding_dashboard_url && state !== "not_started" ? (
          <p className="text-xs text-muted-foreground">
            After you finish the browser flow with Mollie, press <strong className="text-foreground">Refresh status</strong>{" "}
            here so we can load your personal onboarding link (bank and identity) on Mollie&apos;s site.
          </p>
        ) : null}
        {connectStatusQ.isError ? (
          <p className="text-destructive">Could not load Connect status yet. You can still start onboarding.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
