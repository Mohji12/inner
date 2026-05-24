import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getCheckoutCurrencies } from "@/api/payments";
import { listMentorMonthlyInvoices, prepareMentorMonthlyInvoiceCheckout } from "@/api/mentors";
import { CheckoutCurrencySelect } from "@/components/CheckoutCurrencySelect";
import { guessCheckoutCurrencyFromLocale } from "@/lib/checkoutCurrencyGuess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export default function MentorMonthlyFeesPage() {
  const queryClient = useQueryClient();
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

  const prepareCheckoutMut = useMutation({
    mutationFn: (invoiceId: string) =>
      prepareMentorMonthlyInvoiceCheckout(invoiceId, checkoutCurrency),
    onSuccess: (inv) => {
      void queryClient.invalidateQueries({ queryKey: ["mentor", "monthly-invoices"] });
      if (inv.mollie_checkout_url) {
        window.open(inv.mollie_checkout_url, "_blank");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  const rows = data ?? [];

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader className="space-y-4">
        <CardTitle className="font-serif text-2xl">Monthly Platform Fees</CardTitle>
        {currenciesQuery.data?.length ? (
          <div className="max-w-xs">
            <CheckoutCurrencySelect
              id="monthly-fee-ccy"
              label="Checkout currency"
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
          <p className="text-muted-foreground">No monthly fee invoices yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Gross revenue</TableHead>
                <TableHead>Fee (27%)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
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
                            onClick={() => window.open(r.mollie_checkout_url ?? "", "_blank")}
                          >
                            Open current link
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          className="gradient-cta text-white"
                          disabled={prepareCheckoutMut.isPending}
                          onClick={() => prepareCheckoutMut.mutate(r.id)}
                        >
                          Prepare checkout
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
