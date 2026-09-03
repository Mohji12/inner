import { useQuery } from "@tanstack/react-query";
import { downloadMentorSettlementInvoicePdf, listMentorSettlements } from "@/api/mentors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";
import { toast } from "sonner";

export default function MentorSettlementsPage() {
  const { t } = useLanguage();
  const m = t.app.mentorSettlements;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mentor", "settlements"],
    queryFn: listMentorSettlements,
  });

  const onDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const { blob, filename } = await downloadMentorSettlementInvoicePdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `settlement-invoice-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(m.downloadOk);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : m.downloadFail);
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">{m.loading}</p>;
  const rows = data ?? [];

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{m.title}</CardTitle>
        <CardDescription>{m.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground">{m.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.colCycle}</TableHead>
                <TableHead>{m.colGross}</TableHead>
                <TableHead>{m.colFee}</TableHead>
                <TableHead>{m.colNet}</TableHead>
                <TableHead>{m.colStatus}</TableHead>
                <TableHead>{m.colInvoice}</TableHead>
                <TableHead className="text-right">{m.downloadPdf}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.cycle_start} → {r.cycle_end}
                  </TableCell>
                  <TableCell>
                    {r.gross_amount} {r.currency}
                  </TableCell>
                  <TableCell>
                    {r.fee_amount} {r.currency}
                  </TableCell>
                  <TableCell>
                    {r.net_amount} {r.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === r.id}
                      onClick={() => void onDownload(r.id)}
                    >
                      {downloadingId === r.id ? m.loading : m.downloadPdf}
                    </Button>
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
