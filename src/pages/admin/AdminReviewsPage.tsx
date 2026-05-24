import { useQuery } from "@tanstack/react-query";
import { fetchAdminReviews } from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";

export default function AdminReviewsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reviews", limit],
    queryFn: () => fetchAdminReviews(0, limit),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.reviews}</CardTitle>
        <CardDescription>
          {data.total} total · showing {data.items.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Coach</TableHead>
              <TableHead>Text</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.rating}</TableCell>
                <TableCell>{r.user_name}</TableCell>
                <TableCell>{r.mentor_name}</TableCell>
                <TableCell className="max-w-md truncate">{r.review_text ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data.items.length < data.total ? (
          <Button variant="outline" onClick={() => setLimit((l) => l + 50)}>
            {d.loadMore}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
