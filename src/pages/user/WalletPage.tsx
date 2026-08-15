import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getMyWallet } from "@/api/wallets";
import { createWalletTopupIntent, syncMolliePaymentAfterCheckout } from "@/api/payments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  clearPendingMolliePaymentId,
  peekPendingMolliePaymentId,
  stashPendingMolliePaymentId,
} from "@/lib/molliePendingPayment";
import { humanizeApiError } from "@/lib/humanizeApiError";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRESETS = [5, 10, 20, 50, 100] as const;
const MIN_EUR = 5;
const MAX_EUR = 500;

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(",", ".").trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

const WalletPage = () => {
  const { t } = useLanguage();
  const w = t.app.userWallet;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const syncedRef = useRef(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [paying, setPaying] = useState(false);

  const { data: wallet, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["wallet", "me"],
    queryFn: () => getMyWallet(),
  });

  const amount = useMemo(() => parseAmount(customAmount), [customAmount]);
  const amountError = useMemo(() => {
    if (!customAmount.trim()) return "";
    if (amount == null) return w.invalidAmountError;
    if (amount < MIN_EUR) return w.minAmountError;
    if (amount > MAX_EUR) return w.maxAmountError;
    return "";
  }, [amount, customAmount, w.invalidAmountError, w.maxAmountError, w.minAmountError]);
  const canPay = amount != null && amount >= MIN_EUR && amount <= MAX_EUR && !paying;

  useEffect(() => {
    if (syncedRef.current) return;
    const pending = peekPendingMolliePaymentId();
    const topupFlag = searchParams.get("topup");
    if (!pending && topupFlag !== "success") return;
    syncedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        if (pending) {
          const out = await syncMolliePaymentAfterCheckout(pending);
          if (cancelled) return;
          clearPendingMolliePaymentId();
          const st = String(out.status || "").toLowerCase();
          if (st === "paid") toast.success(w.topupSuccess);
          else if (["failed", "canceled", "cancelled", "expired"].includes(st)) toast.error(w.topupFailed);
          else toast.info(w.topupPending);
        } else {
          toast.success(w.topupSuccess);
        }
        await queryClient.invalidateQueries({ queryKey: ["wallet"] });
      } catch {
        if (!cancelled) toast.info(w.topupPending);
      } finally {
        if (!cancelled && topupFlag) {
          const next = new URLSearchParams(searchParams);
          next.delete("topup");
          setSearchParams(next, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient, searchParams, setSearchParams, w.topupFailed, w.topupPending, w.topupSuccess]);

  const selectPreset = (value: number) => {
    setSelectedPreset(value);
    setCustomAmount(String(value));
  };

  const onCustomChange = (value: string) => {
    setCustomAmount(value);
    const parsed = parseAmount(value);
    setSelectedPreset(parsed != null && (PRESETS as readonly number[]).includes(parsed) ? parsed : null);
  };

  const onPay = async () => {
    if (!canPay || amount == null) return;
    setPaying(true);
    try {
      const out = await createWalletTopupIntent({ amount, currency: "EUR" });
      stashPendingMolliePaymentId(out.mollie_payment_id);
      window.location.href = out.checkout_url;
    } catch (e) {
      toast.error(humanizeApiError(e, w.topupStartFailed));
      setPaying(false);
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">{w.loading}</p>;
  }

  if (isError || !wallet) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-accent">{w.label}</p>
          <h1 className="font-serif text-3xl">{w.title}</h1>
        </div>
        <Card className="border-destructive/30">
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-destructive">{w.loadError}</p>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              {w.retry}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">{w.label}</p>
        <h1 className="font-serif text-2xl sm:text-3xl">{w.title}</h1>
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-col items-center justify-center p-6 sm:p-12">
          <p className="text-sm text-muted-foreground mb-2">{w.balanceLabel}</p>
          <h2 className="break-all text-3xl font-bold font-serif text-primary sm:text-5xl">
            {wallet.currency} {wallet.balance.toFixed(2)}
          </h2>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>{w.addMoney}</CardTitle>
          <CardDescription>{w.addMoneyDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{w.presetsHint}</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={selectedPreset === preset ? "default" : "outline"}
                  className={cn(selectedPreset === preset && "ring-2 ring-primary/30")}
                  onClick={() => selectPreset(preset)}
                  disabled={paying}
                >
                  €{preset}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-w-xs">
            <Label htmlFor="wallet-custom-amount">{w.customLabel}</Label>
            <Input
              id="wallet-custom-amount"
              type="number"
              min={MIN_EUR}
              max={MAX_EUR}
              step="0.01"
              inputMode="decimal"
              placeholder={w.customPlaceholder}
              value={customAmount}
              onChange={(e) => onCustomChange(e.target.value)}
              disabled={paying}
            />
            {amountError ? <p className="text-sm text-destructive">{amountError}</p> : null}
          </div>

          <Button type="button" className="w-full sm:w-auto" onClick={() => void onPay()} disabled={!canPay}>
            {paying ? w.paying : w.payWithMollie}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{w.historyTitle}</CardTitle>
          <CardDescription>{w.historyDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {wallet.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{w.emptyTransactions}</p>
          ) : (
            <div className="w-full min-w-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{w.colDate}</TableHead>
                  <TableHead>{w.colDescription}</TableHead>
                  <TableHead>{w.colType}</TableHead>
                  <TableHead className="text-right">{w.colAmount}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallet.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(tx.created_at), "PPP")}
                    </TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell>
                      <span className={`capitalize ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${tx.type === "credit" ? "text-green-600" : "text-red-600"}`}
                    >
                      {tx.type === "credit" ? "+" : "-"}
                      {wallet.currency} {tx.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletPage;
