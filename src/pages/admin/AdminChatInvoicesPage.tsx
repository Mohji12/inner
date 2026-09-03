import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  downloadAdminChatInvoicePdf,
  fetchAdminChatInvoice,
  fetchAdminChatInvoices,
} from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useLanguage } from "@/i18n/LanguageContext";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function AdminChatInvoicesPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [open, setOpen] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "chat-invoices"],
    queryFn: fetchAdminChatInvoices,
  });

  const { data: detail } = useQuery({
    queryKey: ["admin", "chat-invoice", detailSessionId],
    queryFn: () => fetchAdminChatInvoice(detailSessionId!),
    enabled: Boolean(detailSessionId) && open,
  });

  const openDetail = (sessionId: string) => {
    setDetailSessionId(sessionId);
    setOpen(true);
  };

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) setDetailSessionId(null);
  };

  const handleDownload = async (sessionId: string) => {
    setDownloadingId(sessionId);
    try {
      const { blob, filename } = await downloadAdminChatInvoicePdf(sessionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `admin-chat-invoice-${sessionId.slice(0, 8)}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(d.successGeneric);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : d.errorGeneric);
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 glass-card">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{d.chatInvoicesTitle}</CardTitle>
          <CardDescription>
            {d.showingCount.replace("{total}", String(rows.length)).replace("{count}", String(rows.length))}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground">{d.noData}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{d.invoicesTitle}</TableHead>
                  <TableHead>{d.coach}</TableHead>
                  <TableHead>{d.created}</TableHead>
                  <TableHead>{d.time}</TableHead>
                  <TableHead>{d.amount}</TableHead>
                  <TableHead className="text-right">{d.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.session_id}>
                    <TableCell className="font-mono text-sm">{row.invoice_number}</TableCell>
                    <TableCell>{row.mentor_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(row.issued_at)}</TableCell>
                    <TableCell>{row.total_minutes_purchased}</TableCell>
                    <TableCell>
                      {row.total_amount} {row.currency}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => openDetail(row.session_id)}>
                          {d.openDetail}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={downloadingId === row.session_id}
                          onClick={() => void handleDownload(row.session_id)}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          {d.downloadPdf}
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
              {detail ? `${d.invoicesTitle} ${detail.invoice_number}` : d.invoicesTitle}
            </DialogTitle>
            <DialogDescription>{detail ? `${d.created}: ${formatDate(detail.issued_at)}` : ""}</DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="space-y-6 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{d.user}</p>
                  <p className="font-medium">{detail.bill_to_name}</p>
                  <p className="text-muted-foreground">{detail.bill_to_email}</p>
                  {detail.bill_to_phone ? <p className="text-muted-foreground">{detail.bill_to_phone}</p> : null}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{d.provider}</p>
                  <p className="font-medium">{detail.service_provider_name}</p>
                  <p className="text-muted-foreground">{detail.service_provider_email}</p>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{d.time}</p>
                  <p className="font-medium">{detail.total_minutes_purchased}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">{d.when}</p>
                  <p className="font-medium">{formatDuration(detail.session_duration_seconds)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(detail.session_started_at)} – {formatDate(detail.session_ended_at)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-widest text-accent">{d.payments}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{d.time}</TableHead>
                      <TableHead>{d.amount}</TableHead>
                      <TableHead>{d.txnId}</TableHead>
                      <TableHead>{d.created}</TableHead>
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
                <p className="mb-2 text-xs uppercase tracking-widest text-accent">{d.text}</p>
                {(detail.conversation ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{d.noData}</p>
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
                <span className="font-medium">{d.amount}</span>
                <span className="font-serif text-2xl">
                  {detail.total_amount} {detail.currency}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1 gradient-cta text-white"
                  disabled={downloadingId === detail.session_id}
                  onClick={() => void handleDownload(detail.session_id)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {d.downloadPdf}
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{d.tableLoading}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
