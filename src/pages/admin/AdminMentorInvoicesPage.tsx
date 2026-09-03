import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import {
  downloadAdminMentorMonthlyInvoicePdf,
  fetchAdminMentorMonthlyInvoices,
  markAdminMentorMonthlyInvoiceReminder,
  regenerateAdminMentorMonthlyInvoiceLink,
} from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

export default function AdminMentorInvoicesPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const qc = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "mentor-monthly-invoices"],
    queryFn: () => fetchAdminMentorMonthlyInvoices(0, 100),
  });

  const regenMut = useMutation({
    mutationFn: (id: string) => regenerateAdminMentorMonthlyInvoiceLink(id),
    onSuccess: () => {
      toast.success(d.successGeneric);
      void qc.invalidateQueries({ queryKey: ["admin", "mentor-monthly-invoices"] });
    },
    onError: (e: Error) => toast.error(e.message || d.errorGeneric),
  });

  const remindMut = useMutation({
    mutationFn: (id: string) => markAdminMentorMonthlyInvoiceReminder(id),
    onSuccess: () => {
      toast.success(d.successGeneric);
      void qc.invalidateQueries({ queryKey: ["admin", "mentor-monthly-invoices"] });
    },
    onError: (e: Error) => toast.error(e.message || d.errorGeneric),
  });

  const handleDownload = async (invoiceId: string) => {
    setDownloadingId(invoiceId);
    try {
      const { blob, filename } = await downloadAdminMentorMonthlyInvoicePdf(invoiceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `coach-monthly-invoice-${invoiceId.slice(0, 8)}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(d.successGeneric);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : d.errorGeneric);
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading || !data) return <p className="text-muted-foreground">{d.tableLoading}</p>;

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.mentorInvoicesTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{d.coach}</TableHead>
              <TableHead>{d.when}</TableHead>
              <TableHead>{d.amount}</TableHead>
              <TableHead>{d.payment}</TableHead>
              <TableHead>{d.status}</TableHead>
              <TableHead className="text-right">{d.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.mentor_name}</TableCell>
                <TableCell>{r.invoice_month}</TableCell>
                <TableCell>{r.gross_revenue} {r.currency}</TableCell>
                <TableCell>{r.fee_amount} ({r.fee_percent}%)</TableCell>
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {r.mollie_checkout_url ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => window.open(r.mollie_checkout_url ?? "", "_blank")}>
                        {d.openDetail}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === r.id}
                      onClick={() => void handleDownload(r.id)}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      {d.downloadPdf}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => regenMut.mutate(r.id)} disabled={regenMut.isPending}>
                      {d.refresh}
                    </Button>
                    <Button type="button" size="sm" onClick={() => remindMut.mutate(r.id)} disabled={remindMut.isPending}>
                      {d.note}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
