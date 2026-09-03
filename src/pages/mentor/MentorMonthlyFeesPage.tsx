import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getCheckoutCurrencies, syncMolliePaymentAfterCheckout } from "@/api/payments";
import { listMentorMonthlyInvoices, prepareMentorMonthlyInvoiceCheckout } from "@/api/mentors";
import { CheckoutCurrencySelect } from "@/components/CheckoutCurrencySelect";
import { guessCheckoutCurrencyFromLocale } from "@/lib/checkoutCurrencyGuess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  clearPendingMolliePaymentId,
  peekPendingMolliePaymentId,
  stashPendingMolliePaymentId,
} from "@/lib/molliePendingPayment";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
export default function MentorMonthlyFeesPage() {
  const { t } = useLanguage();
  const m = t.app.mentorMonthlyFees;
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const syncedRef = useRef(false);
  const { data, isLoading } = useQuery({
    queryKey: ["mentor", "monthly-invoices"],
    queryFn: listMentorMonthlyInvoices,
  });

  const currenciesQuery = useQuery({
    queryKey: ["checkout-currencies"],
    queryFn: getCheckoutCurrencies,
  });
  const [checkoutCurrency, setCheckoutCurrency] = useState("EUR");
  useEffect(() => {
    const list = currenciesQuery.data;
    if (!list?.length) return;
    setCheckoutCurrency((prev) =>
      list.map((c) => c.toUpperCase()).includes(prev) ? prev : guessCheckoutCurrencyFromLocale(navigator.language, list),
    );
  }, [currenciesQuery.data]);

  useEffect(() => {
    if (syncedRef.current) return;
    const pending = peekPendingMolliePaymentId();
    const flag = searchParams.get("invoicePaid");
    if (!pending && flag !== "1") return;
    syncedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        if (pending) {
          const out = await syncMolliePaymentAfterCheckout(pending);
          if (cancelled) return;
          clearPendingMolliePaymentId();
          const st = String(out.status || "").toLowerCase();
          if (st === "paid") toast.success("Invoice payment confirmed");
          else if (["failed", "canceled", "cancelled", "expired"].includes(st)) toast.error("Invoice payment was not completed");
          else toast.info("Invoice payment is still processing");
        }
        await queryClient.invalidateQueries({ queryKey: ["mentor", "monthly-invoices"] });
      } catch {
        if (!cancelled) toast.info("Invoice payment is still processing");
      } finally {
        if (!cancelled && flag) {
          const next = new URLSearchParams(searchParams);
          next.delete("invoicePaid");
          setSearchParams(next, { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryClient, searchParams, setSearchParams]);

  const prepareCheckoutMut = useMutation({
    mutationFn: (invoiceId: string) =>
      prepareMentorMonthlyInvoiceCheckout(invoiceId, checkoutCurrency),
    onSuccess: (inv) => {
      void queryClient.invalidateQueries({ queryKey: ["mentor", "monthly-invoices"] });
      if (inv.mollie_checkout_url) {
        if (inv.mollie_payment_id) {
          stashPendingMolliePaymentId(inv.mollie_payment_id);
        }
        window.location.href = inv.mollie_checkout_url;
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">{m.loading}</p>;
  const rows = data ?? [];

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader className="space-y-4">
        <CardTitle className="font-serif text-2xl">{m.title}</CardTitle>
        {currenciesQuery.data?.length ? (
          <div className="max-w-xs">
            <CheckoutCurrencySelect
              id="monthly-fee-ccy"
              label={m.checkoutCurrency}
              value={checkoutCurrency}
              onChange={setCheckoutCurrency}
              currencies={currenciesQuery.data}
              disabled={prepareCheckoutMut.isPending}
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">{m.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.colMonth}</TableHead>
                <TableHead>{m.colGross}</TableHead>
                <TableHead>{m.colFee}</TableHead>
                <TableHead>{m.colStatus}</TableHead>
                <TableHead className="text-right">{m.colAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.invoice_month}</TableCell>
                  <TableCell>{r.gross_revenue} {r.currency}</TableCell>
                  <TableCell>{r.fee_amount} ({r.fee_percent}%)</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {r.status !== "paid" ? (
                      <div className="flex flex-col items-end gap-1">
                        {r.mollie_checkout_url ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (r.mollie_payment_id) stashPendingMolliePaymentId(r.mollie_payment_id);
                              window.location.href = r.mollie_checkout_url ?? "";
                            }}
                          >
                            {m.openLink}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          className="gradient-cta text-white"
                          disabled={prepareCheckoutMut.isPending}
                          onClick={() => prepareCheckoutMut.mutate(r.id)}
                        >
                          {prepareCheckoutMut.isPending ? m.preparing : m.prepareCheckout}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
