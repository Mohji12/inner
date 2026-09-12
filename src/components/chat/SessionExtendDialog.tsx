import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { extendChatSession, extendChatSessionWithWallet, getChatSessionExtendQuote } from "@/api/chat";
import { getCheckoutCurrencies } from "@/api/payments";
import { getMyWallet } from "@/api/wallets";
import { CheckoutCurrencySelect } from "@/components/CheckoutCurrencySelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guessCheckoutCurrencyFromLocale } from "@/lib/checkoutCurrencyGuess";
import { stashPendingMolliePaymentId } from "@/lib/molliePendingPayment";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

type Props = {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMinutes?: number;
  /** Resume previously ended conversation */
  resumeMode?: boolean;
  communicationMode?: "call" | "video" | null;
};

function formatEur(value: string | number): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export function SessionExtendDialog({
  sessionId,
  open,
  onOpenChange,
  defaultMinutes = 10,
  resumeMode = false,
  communicationMode = null,
}: Props) {
  const { t } = useLanguage();
  const c = t.app.chatSession;
  const p = t.app.payment;
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [checkoutCurrency, setCheckoutCurrency] = useState("EUR");

  const currenciesQuery = useQuery({
    queryKey: ["checkout-currencies"],
    queryFn: getCheckoutCurrencies,
    enabled: open,
  });

  const walletQuery = useQuery({
    queryKey: ["wallet", "me"],
    queryFn: getMyWallet,
    enabled: open,
  });

  useEffect(() => {
    const list = currenciesQuery.data;
    if (!list?.length) return;
    setCheckoutCurrency((prev) =>
      list.map((c) => c.toUpperCase()).includes(prev)
        ? prev
        : guessCheckoutCurrencyFromLocale(navigator.language, list),
    );
  }, [currenciesQuery.data]);

  useEffect(() => {
    if (open) setMinutes(defaultMinutes);
  }, [open, defaultMinutes]);

  const quoteQuery = useQuery({
    queryKey: ["chat", "session", sessionId, "extend-quote", minutes, checkoutCurrency],
    queryFn: () =>
      getChatSessionExtendQuote(sessionId, {
        minutes,
        checkout_currency: checkoutCurrency,
      }),
    enabled: open && Boolean(sessionId) && minutes >= 1,
    retry: false,
  });

  const quote = quoteQuery.data;
  const quoteError = quoteQuery.error as Error | undefined;
  const minMinutes = quote?.min_minutes ?? 1;
  const totalDue = Number.parseFloat(quote?.total_eur ?? "0") || 0;
  const walletBalance = Number(walletQuery.data?.balance ?? 0);
  const canPayFromWallet = totalDue > 0 && walletBalance >= totalDue - 1e-9;
  const walletShortfall = Math.max(0, totalDue - walletBalance);

  const refreshAfterPay = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["chat", "session", sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["meeting", "session", sessionId] }),
      queryClient.invalidateQueries({ queryKey: ["wallet"] }),
      queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] }),
    ]);
  };

  const mollieMut = useMutation({
    mutationFn: () =>
      extendChatSession(sessionId, {
        minutes,
        checkout_currency: checkoutCurrency,
        return_origin: typeof window !== "undefined" ? window.location.origin : null,
        communication_mode: communicationMode,
      }),
    onSuccess: (out) => {
      toast.success(c.toastTimerPausedCheckout);
      onOpenChange(false);
      stashPendingMolliePaymentId(out.mollie_payment_id);
      window.location.href = out.checkout_url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const walletMut = useMutation({
    mutationFn: () =>
      extendChatSessionWithWallet(sessionId, {
        minutes,
        communication_mode: communicationMode,
      }),
    onSuccess: async () => {
      toast.success(c.toastTimeAdded);
      onOpenChange(false);
      await refreshAfterPay();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = mollieMut.isPending || walletMut.isPending;
  const checkoutCcy = quote?.checkout_currency ?? checkoutCurrency;
  const showCheckoutTotal = checkoutCcy !== "EUR" && quote?.checkout_amount;
  const payAction = resumeMode ? c.payAndContinue : c.payAndExtend;
  const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : `/user/chat/${sessionId}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{resumeMode ? c.extendTitleResume : c.extendTitleAdd}</DialogTitle>
          <DialogDescription>
            {resumeMode ? c.extendDescResume : c.extendDescAdd}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {currenciesQuery.data?.length ? (
            <CheckoutCurrencySelect
              id="extend-checkout-ccy"
              value={checkoutCurrency}
              onChange={setCheckoutCurrency}
              currencies={currenciesQuery.data}
              disabled={busy}
            />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="extMin">{c.minutesToAdd}</Label>
            <Input
              id="extMin"
              type="number"
              min={minMinutes}
              max={480}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
              disabled={busy}
            />
            {quote?.min_minutes && quote.min_minutes > 1 ? (
              <p className="text-xs text-muted-foreground">
                {c.minimumPurchase.replace("{minutes}", String(quote.min_minutes))}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm">
            {quoteQuery.isLoading ? (
              <p className="text-muted-foreground">{c.calculatingPrice}</p>
            ) : quoteError ? (
              <p className="text-destructive">{quoteError.message}</p>
            ) : quote ? (
              <div className="space-y-1">
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {c.rateLine
                      .replace("{minutes}", String(quote.minutes))
                      .replace("{rate}", formatEur(quote.rate_per_minute_eur))}
                  </span>
                  <span>EUR {formatEur(quote.session_amount_eur)}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{c.transactionFee}</span>
                  <span>EUR {formatEur(quote.transaction_fee_eur)}</span>
                </p>
                <hr className="my-2 border-border/70" />
                <p className="flex justify-between gap-4 font-semibold">
                  <span>{c.totalDue}</span>
                  <span>EUR {formatEur(quote.total_eur)}</span>
                </p>
                {showCheckoutTotal ? (
                  <p className="flex justify-between gap-4 text-xs text-muted-foreground">
                    <span>{c.mollieCheckout.replace("{currency}", checkoutCcy)}</span>
                    <span>
                      {checkoutCcy} {formatEur(quote.checkout_amount)}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {quote && !quoteError ? (
            <div className="rounded-lg border border-border/70 bg-background px-3 py-3 text-sm space-y-2">
              <p className="font-medium">{c.choosePaymentMethod}</p>
              <p className="text-muted-foreground">
                {p.walletBalance.replace("{balance}", walletBalance.toFixed(2))}
              </p>
              {!canPayFromWallet && totalDue > 0 ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  {p.insufficientHint.replace("{needed}", walletShortfall.toFixed(2))}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {c.cancel}
            </Button>
            {canPayFromWallet ? (
              <Button
                variant="secondary"
                disabled={busy || quoteQuery.isLoading || Boolean(quoteError) || !quote}
                onClick={() => walletMut.mutate()}
              >
                <Wallet className="mr-2 h-4 w-4" />
                {walletMut.isPending
                  ? c.payingFromWallet
                  : c.payFromWalletAmount.replace("{amount}", formatEur(totalDue))}
              </Button>
            ) : quote && totalDue > 0 ? (
              <Button asChild variant="secondary">
                <Link to={`/user/wallet?returnTo=${encodeURIComponent(returnTo)}`}>
                  <Wallet className="mr-2 h-4 w-4" />
                  {c.addMoneyToWallet}
                </Link>
              </Button>
            ) : null}
            <Button
              className="gradient-cta text-white"
              onClick={() => mollieMut.mutate()}
              disabled={busy || quoteQuery.isLoading || Boolean(quoteError) || !quote}
            >
              {mollieMut.isPending
                ? c.redirecting
                : quote
                  ? c.payWithMollieAmount
                      .replace("{action}", payAction)
                      .replace("{amount}", formatEur(quote.total_eur))
                  : payAction}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
