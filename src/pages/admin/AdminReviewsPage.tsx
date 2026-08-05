import { useQuery } from "@tanstack/react-query";
import { fetchAdminReviews } from "@/api/admin";
import {
  AdminEntityFilters,
  emptyAdminEntityFilters,
  toAdminEntityApiFilters,
} from "@/components/admin/AdminEntityFilters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMemo, useState } from "react";

export default function AdminReviewsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [limit, setLimit] = useState(50);
  const [draft, setDraft] = useState(emptyAdminEntityFilters);
  const [applied, setApplied] = useState(emptyAdminEntityFilters);
  const apiFilters = useMemo(() => toAdminEntityApiFilters(applied), [applied]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "reviews", limit, apiFilters],
    queryFn: () => fetchAdminReviews(0, limit, apiFilters),
  });

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.reviews}</CardTitle>
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
                  <TableHead>{d.rating}</TableHead>
                  <TableHead>{d.user}</TableHead>
                  <TableHead>{d.coach}</TableHead>
                  <TableHead>{d.text}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {d.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{r.rating}</TableCell>
                      <TableCell>{r.user_name}</TableCell>
                      <TableCell>{r.mentor_name}</TableCell>
                      <TableCell className="max-w-md truncate">{r.review_text ?? "—"}</TableCell>
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
