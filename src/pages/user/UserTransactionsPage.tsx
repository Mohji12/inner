import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadChatInvoicePdf, getChatInvoice, listChatInvoices } from "@/api/chat";
import type { ChatInvoiceSummary } from "@/api/types";
import {
  fetchUserBookingInvoice,
  listUserBookingInvoices,
  saveUserBookingInvoicePdf,
  type BookingInvoiceSummary,
} from "@/api/invoices";
import { useLanguage } from "@/i18n/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ChatTransactionRow = ChatInvoiceSummary & { kind: "chat_session"; rowKey: string };
type BookingTransactionRow = BookingInvoiceSummary & { rowKey: string };
type TransactionRow = ChatTransactionRow | BookingTransactionRow;

type DetailTarget =
  | { kind: "chat_session"; sessionId: string }
  | { kind: "booking_session"; bookingId: string };

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function isPaidStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "paid" || normalized === "succeeded";
}

const UserTransactionsPage = () => {
  const { t } = useLanguage();
  const tx = t.app.userTransactions;
  const [open, setOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  const { data: chatRows = [], isLoading: chatLoading } = useQuery({
    queryKey: ["chat", "invoices"],
    queryFn: listChatInvoices,
  });

  const { data: bookingRows = [], isLoading: bookingLoading } = useQuery({
    queryKey: ["invoices", "bookings"],
    queryFn: listUserBookingInvoices,
  });

  const rows = useMemo<TransactionRow[]>(() => {
    const merged: TransactionRow[] = [
      ...chatRows.map(
        (row): ChatTransactionRow => ({
          ...row,
          kind: "chat_session",
          rowKey: `chat-${row.session_id}`,
        }),
      ),
      ...bookingRows.map(
        (row): BookingTransactionRow => ({
          ...row,
          rowKey: `booking-${row.booking_id}`,
        }),
      ),
    ];
    return merged.sort(
      (a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime(),
    );
  }, [chatRows, bookingRows]);

  const isLoading = chatLoading || bookingLoading;

  const { data: chatDetail } = useQuery({
    queryKey: ["chat", "invoice", detailTarget?.kind === "chat_session" ? detailTarget.sessionId : null],
    queryFn: () => getChatInvoice(detailTarget!.sessionId),
    enabled: Boolean(detailTarget?.kind === "chat_session") && open,
  });

  const { data: bookingDetail } = useQuery({
    queryKey: ["invoices", "booking", detailTarget?.kind === "booking_session" ? detailTarget.bookingId : null],
    queryFn: () => fetchUserBookingInvoice(detailTarget!.bookingId),
    enabled: Boolean(detailTarget?.kind === "booking_session") && open,
  });

  const openDetail = (target: DetailTarget) => {
    setDetailTarget(target);
    setOpen(true);
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setDetailTarget(null);
  };

  const handleChatDownload = async (sessionId: string) => {
    const key = `chat-${sessionId}`;
    setDownloadingKey(key);
    try {
      const { blob, filename } = await downloadChatInvoicePdf(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `invoice-${sessionId.slice(0, 8)}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(tx.invoiceDownloaded);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleBookingDownload = async (bookingId: string) => {
    const key = `booking-${bookingId}`;
    setDownloadingKey(key);
    try {
      await saveUserBookingInvoicePdf(bookingId);
      toast.success(tx.invoiceDownloaded);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingKey(null);
    }
  };

  const customerName = (row: TransactionRow) =>
    row.kind === "chat_session" ? row.customer_display_name ?? "—" : row.customer_name;

  const minutesLabel = (row: TransactionRow) =>
    row.kind === "chat_session" ? row.total_minutes_purchased : row.duration_minutes;

  const typeLabel = (row: TransactionRow) =>
    row.kind === "chat_session" ? tx.typeChat : tx.typeBooking;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-accent">{tx.title}</p>
        <h1 className="font-serif text-3xl">{tx.title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{tx.subtitle}</p>
      </div>

      <Card className="border-border/60">
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-muted-foreground">{tx.loading}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">{tx.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx.invoiceNo}</TableHead>
                  <TableHead>{tx.type}</TableHead>
                  <TableHead>{tx.customer}</TableHead>
                  <TableHead>{tx.mentor}</TableHead>
                  <TableHead>{tx.issued}</TableHead>
                  <TableHead>{tx.purchasedMinutes}</TableHead>
                  <TableHead>{tx.total}</TableHead>
                  <TableHead className="min-w-[200px] text-right">{tx.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.rowKey}>
                    <TableCell className="font-mono text-sm">{r.invoice_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm">{typeLabel(r)}</span>
                        {r.kind === "booking_session" && r.promo_applied ? (
                          <Badge variant="secondary" className="text-xs">
                            {tx.promoApplied}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{customerName(r)}</TableCell>
                    <TableCell>{r.mentor_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.issued_at)}</TableCell>
                    <TableCell>{minutesLabel(r)}</TableCell>
                    <TableCell>
                      {r.total_amount} {r.currency}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openDetail(
                              r.kind === "chat_session"
                                ? { kind: "chat_session", sessionId: r.session_id }
                                : { kind: "booking_session", bookingId: r.booking_id },
                            )
                          }
                        >
                          {tx.viewInvoice}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={downloadingKey === r.rowKey || !isPaidStatus(r.payment_status)}
                          onClick={() =>
                            void (r.kind === "chat_session"
                              ? handleChatDownload(r.session_id)
                              : handleBookingDownload(r.booking_id))
                          }
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          {tx.downloadInvoice}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {chatDetail
                ? `${tx.invoiceNo} ${chatDetail.invoice_number}`
                : bookingDetail
                  ? `${tx.invoiceNo} ${bookingDetail.invoice_number}`
                  : tx.title}
            </DialogTitle>
            <DialogDescription>
              {chatDetail
                ? `${tx.issued}: ${formatDate(chatDetail.issued_at)}`
                : bookingDetail
                  ? `${tx.issued}: ${formatDate(bookingDetail.issued_at)}`
                  : ""}
            </DialogDescription>
          </DialogHeader>

          {detailTarget?.kind === "chat_session" ? (
            chatDetail ? (
              <div className="space-y-6 text-sm">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-widest text-accent">{tx.paymentStatus}</p>
                  <p className="text-lg font-medium capitalize">
                    {isPaidStatus(chatDetail.payment_status) ? tx.paid : chatDetail.payment_status}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.billTo}</p>
                    <p className="font-medium">{chatDetail.bill_to_name}</p>
                    <p className="text-muted-foreground">{chatDetail.bill_to_email}</p>
                    {chatDetail.bill_to_phone ? (
                      <p className="text-muted-foreground">{chatDetail.bill_to_phone}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.serviceProvider}</p>
                    <p className="font-medium">{chatDetail.service_provider_name}</p>
                    <p className="text-muted-foreground">{chatDetail.service_provider_email}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.purchasedMinutes}</p>
                    <p className="font-medium">{chatDetail.total_minutes_purchased} min</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.sessionDuration}</p>
                    <p className="font-medium">{formatDuration(chatDetail.session_duration_seconds)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(chatDetail.session_started_at)} → {formatDate(chatDetail.session_ended_at)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-widest text-accent">{tx.lineItems}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tx.minutes}</TableHead>
                        <TableHead>{tx.amount}</TableHead>
                        <TableHead>{tx.txnRef}</TableHead>
                        <TableHead>{tx.issued}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chatDetail.line_items.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>{line.minutes}</TableCell>
                          <TableCell>
                            {line.amount} {line.currency}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{line.transaction_id ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(line.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <p className="mb-2 text-xs uppercase tracking-widest text-accent">{tx.conversationTranscript}</p>
                  {(chatDetail.conversation ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tx.emptyConversation}</p>
                  ) : (
                    <ScrollArea className="max-h-64 rounded-md border border-border/70 p-3">
                      <div className="space-y-3 pr-3 text-sm">
                        {(chatDetail.conversation ?? []).map((m) => (
                          <div
                            key={m.id}
                            className={
                              m.sender_role === "user"
                                ? "rounded-lg border border-border/50 bg-muted/30 p-2"
                                : "rounded-lg border border-primary/20 bg-primary/5 p-2"
                            }
                          >
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{m.sender_display_name}</span>
                              {" · "}
                              {formatDate(m.created_at)}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <span className="font-medium">{tx.total}</span>
                  <span className="font-serif text-2xl">
                    {chatDetail.total_amount} {chatDetail.currency}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">{tx.downloadHintPdf}</p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1 gradient-cta text-white"
                    disabled={
                      downloadingKey === `chat-${chatDetail.session_id}` ||
                      !isPaidStatus(chatDetail.payment_status)
                    }
                    onClick={() => void handleChatDownload(chatDetail.session_id)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {tx.downloadInvoice}
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                    {tx.close}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">{tx.loading}</p>
            )
          ) : detailTarget?.kind === "booking_session" ? (
            bookingDetail ? (
              <div className="space-y-6 text-sm">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-widest text-accent">{tx.paymentStatus}</p>
                  <p className="text-lg font-medium capitalize">
                    {isPaidStatus(bookingDetail.payment_status) ? tx.paid : bookingDetail.payment_status}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.billTo}</p>
                    <p className="font-medium">{bookingDetail.bill_to_name}</p>
                    <p className="text-muted-foreground">{bookingDetail.bill_to_email}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.serviceProvider}</p>
                    <p className="font-medium">{bookingDetail.mentor_name}</p>
                    <p className="text-muted-foreground">{bookingDetail.mentor_email}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.duration}</p>
                    <p className="font-medium">{bookingDetail.duration_minutes} min</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.sessionDuration}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(bookingDetail.session_start_at_utc)} →{" "}
                      {formatDate(bookingDetail.session_end_at_utc)}
                    </p>
                  </div>
                </div>

                {bookingDetail.session_topic ? (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.sessionTopic}</p>
                    <p className="font-medium">{bookingDetail.session_topic}</p>
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-xs uppercase tracking-widest text-accent">{tx.lineItems}</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tx.type}</TableHead>
                        <TableHead>{tx.amount}</TableHead>
                        <TableHead>{tx.txnRef}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>{bookingDetail.line_description}</TableCell>
                        <TableCell>
                          {bookingDetail.payment_amount} {bookingDetail.payment_currency}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{bookingDetail.transaction_id ?? "—"}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <span className="font-medium">{tx.total}</span>
                  <span className="font-serif text-2xl">
                    {bookingDetail.payment_amount} {bookingDetail.payment_currency}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">{tx.downloadHintPdf}</p>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="flex-1 gradient-cta text-white"
                    disabled={
                      downloadingKey === `booking-${bookingDetail.booking_id}` ||
                      !isPaidStatus(bookingDetail.payment_status)
                    }
                    onClick={() => void handleBookingDownload(bookingDetail.booking_id)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {tx.downloadInvoice}
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                    {tx.close}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">{tx.loading}</p>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserTransactionsPage;
