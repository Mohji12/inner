import { useQuery } from "@tanstack/react-query";
import { fetchAdminPayments } from "@/api/admin";
import {
  AdminEntityFilters,
  emptyAdminEntityFilters,
  toAdminEntityApiFilters,
} from "@/components/admin/AdminEntityFilters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMemo, useState } from "react";

export default function AdminPaymentsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [limit, setLimit] = useState(50);
  const [draft, setDraft] = useState(emptyAdminEntityFilters);
  const [applied, setApplied] = useState(emptyAdminEntityFilters);
  const apiFilters = useMemo(() => toAdminEntityApiFilters(applied), [applied]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "payments", limit, apiFilters],
    queryFn: () => fetchAdminPayments(0, limit, apiFilters),
  });

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.payments}</CardTitle>
        <CardDescription>
          {data
            ? d.showingCount.replace("{total}", String(data.total)).replace("{count}", String(data.items.length))
            : d.tableLoading}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AdminEntityFilters
          value={draft}
          onChange={setDraft}
          onApply={() => {
            setLimit(50);
            setApplied({ ...draft });
          }}
          onClear={() => {
            const empty = emptyAdminEntityFilters();
            setDraft(empty);
            setApplied(empty);
            setLimit(50);
          }}
        />
        {isError ? (
          <p className="text-sm text-destructive">
            {(error as Error)?.message || d.tableLoading}
          </p>
        ) : null}
        {isLoading && !data ? <p className="text-muted-foreground">{d.tableLoading}</p> : null}
        {data ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{d.when}</TableHead>
                  <TableHead>{d.amount}</TableHead>
                  <TableHead>{d.status}</TableHead>
                  <TableHead>{d.gateway}</TableHead>
                  <TableHead>{d.booking}</TableHead>
                  <TableHead>{d.txnId}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {d.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(p.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {p.amount} {p.currency}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.status}</Badge>
                      </TableCell>
                      <TableCell>{p.payment_gateway}</TableCell>
                      <TableCell className="font-mono text-xs">{p.booking_id.slice(0, 8)}…</TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs">
                        {p.transaction_id ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {data.items.length < data.total ? (
              <Button variant="outline" onClick={() => setLimit((l) => l + 50)}>
                {d.loadMore}
              </Button>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
