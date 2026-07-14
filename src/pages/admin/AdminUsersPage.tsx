import { useQuery } from "@tanstack/react-query";
import { fetchAdminUsers } from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "users", limit, q],
    queryFn: () => fetchAdminUsers(0, limit, q.trim() || undefined),
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.users}</CardTitle>
        <CardDescription>
          {d.showingCount.replace("{total}", String(data.total)).replace("{count}", String(data.items.length))}
        </CardDescription>
        <div className="max-w-sm pt-2">
          <Input
            placeholder={d.searchEmailName}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void refetch();
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{d.ownerId}</TableHead>
              <TableHead>{d.name}</TableHead>
              <TableHead>{d.email}</TableHead>
              <TableHead>{d.phone}</TableHead>
              <TableHead>{d.status}</TableHead>
              <TableHead>{d.emailVerified}</TableHead>
              <TableHead>{d.created}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.id}</TableCell>
                <TableCell>{u.full_name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.phone_number}</TableCell>
                <TableCell>
                  <Badge variant="outline">{u.account_status}</Badge>
                </TableCell>
                <TableCell>{u.email_verified ? d.yes : d.no}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleString()}</TableCell>
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
