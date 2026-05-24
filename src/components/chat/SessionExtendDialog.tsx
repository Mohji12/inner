import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { extendChatSession, getChatSessionExtendQuote } from "@/api/chat";
import { getCheckoutCurrencies } from "@/api/payments";
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

type Props = {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMinutes?: number;
};

function formatEur(value: string | number): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export function SessionExtendDialog({ sessionId, open, onOpenChange, defaultMinutes = 10 }: Props) {
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [checkoutCurrency, setCheckoutCurrency] = useState("EUR");

  const currenciesQuery = useQuery({
    queryKey: ["checkout-currencies"],
    queryFn: getCheckoutCurrencies,
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

  const extendMut = useMutation({
    mutationFn: () => extendChatSession(sessionId, { minutes, checkout_currency: checkoutCurrency }),
    onSuccess: (out) => {
      toast.success("Redirecting to Mollie checkout");
      onOpenChange(false);
      stashPendingMolliePaymentId(out.mollie_payment_id);
      window.location.href = out.checkout_url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkoutCcy = quote?.checkout_currency ?? checkoutCurrency;
  const showCheckoutTotal = checkoutCcy !== "EUR" && quote?.checkout_amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add time</DialogTitle>
          <DialogDescription>
            Pay per minute at your coach&apos;s rate plus a transaction fee. Minutes are added after successful payment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {currenciesQuery.data?.length ? (
            <CheckoutCurrencySelect
              id="extend-checkout-ccy"
              value={checkoutCurrency}
              onChange={setCheckoutCurrency}
              currencies={currenciesQuery.data}
              disabled={extendMut.isPending}
            />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="extMin">Minutes to add</Label>
            <Input
              id="extMin"
              type="number"
              min={minMinutes}
              max={480}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
              disabled={extendMut.isPending}
            />
            {quote?.min_minutes && quote.min_minutes > 1 ? (
              <p className="text-xs text-muted-foreground">Minimum purchase: {quote.min_minutes} minutes</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm">
            {quoteQuery.isLoading ? (
              <p className="text-muted-foreground">Calculating price…</p>
            ) : quoteError ? (
              <p className="text-destructive">{quoteError.message}</p>
            ) : quote ? (
              <div className="space-y-1">
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {quote.minutes} min × EUR {formatEur(quote.rate_per_minute_eur)}/min
                  </span>
                  <span>EUR {formatEur(quote.session_amount_eur)}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Transaction fee</span>
                  <span>EUR {formatEur(quote.transaction_fee_eur)}</span>
                </p>
                <hr className="my-2 border-border/70" />
                <p className="flex justify-between gap-4 font-semibold">
                  <span>Total due</span>
                  <span>EUR {formatEur(quote.total_eur)}</span>
                </p>
                {showCheckoutTotal ? (
                  <p className="flex justify-between gap-4 text-xs text-muted-foreground">
                    <span>Mollie checkout ({checkoutCcy})</span>
                    <span>
                      {checkoutCcy} {formatEur(quote.checkout_amount)}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={extendMut.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => extendMut.mutate()}
            disabled={extendMut.isPending || quoteQuery.isLoading || Boolean(quoteError) || !quote}
          >
            {extendMut.isPending
              ? "Redirecting…"
              : quote
                ? `Pay & extend — EUR ${formatEur(quote.total_eur)}`
                : "Pay & extend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
