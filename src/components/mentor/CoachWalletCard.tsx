import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

import { getCoachWalletBalances } from "@/api/mentors";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";

export function CoachWalletCard() {
  const { t } = useLanguage();
  const m = t.app.coachWallet;
  const walletQ = useQuery({
    queryKey: ["mentor", "marketplace", "wallet"],
    queryFn: () => getCoachWalletBalances("EUR"),
  });

  const data = walletQ.data;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          {m.label}
        </CardDescription>
        <CardTitle className="font-serif text-2xl">
          {walletQ.isLoading ? m.loading : `${data?.currency ?? "EUR"} ${data?.available_balance ?? "0.00"}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>
          {m.pending}:{" "}
          <span className="font-medium text-foreground">
            {data?.currency ?? "EUR"} {data?.pending_balance ?? "0.00"}
          </span>
        </p>
        <p>
          {m.withdrawable}:{" "}
          <span className="font-medium text-foreground">
            {data?.currency ?? "EUR"} {data?.withdrawable_balance ?? "0.00"}
          </span>
        </p>
        {walletQ.isError ? <p className="text-destructive">{m.loadError}</p> : null}
      </CardContent>
    </Card>
  );
}
