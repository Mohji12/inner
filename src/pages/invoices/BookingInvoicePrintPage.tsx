import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { fetchMentorBookingInvoice, fetchUserBookingInvoice, type BookingInvoice } from "@/api/invoices";
import { InvoicePrintChrome } from "@/components/invoices/InvoicePrintChrome";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/i18n/LanguageContext";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function BookingInvoiceBody({ inv }: { inv: BookingInvoice }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-8 text-sm leading-relaxed">
      <header className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">{t.app.invoice.invoice}</p>
          <p className="font-serif text-3xl font-semibold tracking-tight text-foreground">{inv.platform_legal_name}</p>
          <p className="mt-1 text-muted-foreground">{inv.platform_contact_email}</p>
        </div>
        <div className="text-right sm:min-w-[200px]">
          <p className="font-mono text-lg font-medium text-foreground">{inv.invoice_number}</p>
          <p className="mt-1 text-muted-foreground">{t.app.invoice.issued} {formatWhen(inv.issued_at)}</p>
          <Badge variant="outline" className="mt-2 capitalize">
            {inv.payment_status}
          </Badge>
        </div>
      </header>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.app.invoice.billTo}</p>
          <p className="mt-2 text-base font-medium text-foreground">{inv.bill_to_name}</p>
          <p className="text-muted-foreground">{inv.bill_to_email}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.app.invoice.coach}</p>
          <p className="mt-2 text-base font-medium text-foreground">{inv.mentor_name}</p>
          <p className="text-muted-foreground">{inv.mentor_email}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.app.invoice.session}</p>
        <p className="mt-2 font-medium text-foreground">
          {formatWhen(inv.session_start_at_utc)} — {formatWhen(inv.session_end_at_utc)}
        </p>
        <p className="mt-1 text-muted-foreground">
          {inv.duration_minutes} {t.app.invoice.minutes} · {t.app.invoice.booking} {inv.booking_id.slice(0, 8)}… · {inv.booking_status}
        </p>
      </div>

      <Separator />

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.app.invoice.charges}</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
          <div className="grid grid-cols-[1fr_auto] gap-4 bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{t.app.invoice.description}</span>
            <span className="text-right">{t.app.invoice.amount}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-border/60 px-4 py-4">
            <span className="text-foreground">{inv.line_description}</span>
            <span className="text-right font-semibold tabular-nums text-foreground">
              {inv.payment_amount} {inv.payment_currency}
            </span>
          </div>
        </div>
        <div className="mt-4 flex flex-col items-end gap-1">
          <p className="text-lg font-semibold tabular-nums text-foreground">
            {t.app.invoice.total} {inv.payment_amount} {inv.payment_currency}
          </p>
          {inv.amount_base_eur ? (
            <p className="text-xs text-muted-foreground">{t.app.invoice.referenceEurBase}: {inv.amount_base_eur} EUR</p>
          ) : null}
          {inv.transaction_id ? (
            <p className="font-mono text-xs text-muted-foreground">{t.app.invoice.txn} {inv.transaction_id}</p>
          ) : null}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground print:pt-8">
        {t.app.invoice.thanks} {inv.platform_legal_name}.
      </p>
    </div>
  );
}

export default function BookingInvoicePrintPage({ side }: { side: "user" | "mentor" }) {
  const { t } = useLanguage();
  const { bookingId } = useParams<{ bookingId: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["invoice", "booking", side, bookingId],
    queryFn: () => (side === "user" ? fetchUserBookingInvoice(bookingId!) : fetchMentorBookingInvoice(bookingId!)),
    enabled: Boolean(bookingId),
  });

  const back = side === "user" ? "/user/appointments" : "/mentor/appointments";

  if (!bookingId) return <p className="p-6 text-muted-foreground">{t.app.invoice.missingBooking}</p>;
  if (isLoading) return <p className="p-6 text-muted-foreground">{t.app.invoice.loadingInvoice}</p>;
  if (error || !data) return <p className="p-6 text-destructive">{error instanceof Error ? error.message : t.app.invoice.loadError}</p>;

  return (
    <InvoicePrintChrome title={t.app.invoice.sessionInvoice} backTo={back} backLabel={t.app.invoice.backToAppointments}>
      <BookingInvoiceBody inv={data} />
    </InvoicePrintChrome>
  );
}
