import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadChatInvoicePdf, getChatInvoice, listChatInvoices } from "@/api/chat";
import { useLanguage } from "@/i18n/LanguageContext";
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

const UserTransactionsPage = () => {
  const { t } = useLanguage();
  const tx = t.app.userTransactions;
  const [open, setOpen] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["chat", "invoices"],
    queryFn: listChatInvoices,
  });

  const { data: detail } = useQuery({
    queryKey: ["chat", "invoice", detailSessionId],
    queryFn: () => getChatInvoice(detailSessionId!),
    enabled: Boolean(detailSessionId) && open,
  });

  const openDetail = (sessionId: string) => {
    setDetailSessionId(sessionId);
    setOpen(true);
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setDetailSessionId(null);
  };

  const handleDownload = async (sessionId: string) => {
    setDownloadingId(sessionId);
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
      setDownloadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
                  <TableHead>{tx.mentor}</TableHead>
                  <TableHead>{tx.issued}</TableHead>
                  <TableHead>{tx.purchasedMinutes}</TableHead>
                  <TableHead>{tx.total}</TableHead>
                  <TableHead className="min-w-[200px] text-right">{tx.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.session_id}>
                    <TableCell className="font-mono text-sm">{r.invoice_number}</TableCell>
                    <TableCell>{r.mentor_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.issued_at)}</TableCell>
                    <TableCell>{r.total_minutes_purchased}</TableCell>
                    <TableCell>
                      {r.total_amount} {r.currency}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openDetail(r.session_id)}>
                          {tx.viewInvoice}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={downloadingId === r.session_id || r.payment_status !== "paid"}
                          onClick={() => void handleDownload(r.session_id)}
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
              {detail ? `${tx.invoiceNo} ${detail.invoice_number}` : tx.title}
            </DialogTitle>
            <DialogDescription>
              {detail ? `${tx.issued}: ${formatDate(detail.issued_at)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-6 text-sm">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-widest text-accent">{tx.paymentStatus}</p>
                <p className="text-lg font-medium capitalize">
                  {detail.payment_status === "paid" ? tx.paid : detail.payment_status}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.billTo}</p>
                  <p className="font-medium">{detail.bill_to_name}</p>
                  <p className="text-muted-foreground">{detail.bill_to_email}</p>
                  {detail.bill_to_phone ? <p className="text-muted-foreground">{detail.bill_to_phone}</p> : null}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.serviceProvider}</p>
                  <p className="font-medium">{detail.service_provider_name}</p>
                  <p className="text-muted-foreground">{detail.service_provider_email}</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.purchasedMinutes}</p>
                  <p className="font-medium">{detail.total_minutes_purchased} min</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{tx.sessionDuration}</p>
                  <p className="font-medium">{formatDuration(detail.session_duration_seconds)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(detail.session_started_at)} → {formatDate(detail.session_ended_at)}
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
                    {detail.line_items.map((line) => (
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
                {(detail.conversation ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tx.emptyConversation}</p>
                ) : (
                  <ScrollArea className="max-h-64 rounded-md border border-border/70 p-3">
                    <div className="space-y-3 pr-3 text-sm">
                      {(detail.conversation ?? []).map((m) => (
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
                  {detail.total_amount} {detail.currency}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">{tx.downloadHintPdf}</p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1 gradient-cta text-white"
                  disabled={downloadingId === detail.session_id || detail.payment_status !== "paid"}
                  onClick={() => void handleDownload(detail.session_id)}
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserTransactionsPage;
