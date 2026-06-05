import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchAdminCoachApplications,
  updateAdminCoachApplication,
  type AdminCoachApplicationRow,
  type CoachApplicationStatus,
} from "@/api/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const STATUS_OPTIONS: CoachApplicationStatus[] = ["new", "reviewed", "contacted", "rejected"];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "new") return "default";
  if (status === "contacted") return "secondary";
  if (status === "rejected") return "destructive";
  return "outline";
}

export default function AdminCoachApplicationsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<AdminCoachApplicationRow | null>(null);
  const [editStatus, setEditStatus] = useState<CoachApplicationStatus>("new");
  const [editNotes, setEditNotes] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "coach-applications", limit, q, statusFilter],
    queryFn: () =>
      fetchAdminCoachApplications(0, limit, q.trim() || undefined, statusFilter === "all" ? undefined : statusFilter),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      status,
      admin_notes,
    }: {
      id: string;
      status: CoachApplicationStatus;
      admin_notes: string | null;
    }) => updateAdminCoachApplication(id, { status, admin_notes }),
    onSuccess: (row) => {
      toast.success("Application updated");
      setSelected(row);
      queryClient.invalidateQueries({ queryKey: ["admin", "coach-applications"] });
    },
    onError: (e: Error) => toast.error(e.message || "Update failed"),
  });

  const openDetail = (row: AdminCoachApplicationRow) => {
    setSelected(row);
    setEditStatus((row.status as CoachApplicationStatus) || "new");
    setEditNotes(row.admin_notes ?? "");
  };

  const saveDetail = () => {
    if (!selected) return;
    updateMut.mutate({
      id: selected.id,
      status: editStatus,
      admin_notes: editNotes.trim() || null,
    });
  };

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error instanceof Error ? error.message : "Could not load applications."}</p>
          <Button className="mt-4" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/60 glass-card">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">{d.coachApplications}</CardTitle>
          <CardDescription>
            {data.total} total · showing {data.items.length}
          </CardDescription>
          <div className="flex flex-wrap gap-3 pt-2">
            <Input
              className="max-w-xs"
              placeholder="Search name, email, headline"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void refetch();
              }}
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void refetch()}>
              Search
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Headline</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No applications yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{row.headline}</TableCell>
                    <TableCell>{row.years_of_experience} yrs</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="secondary" onClick={() => openDetail(row)}>
                        View
                      </Button>
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
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{selected?.full_name}</DialogTitle>
            <DialogDescription>{selected?.email}</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4 text-sm">
              <dl className="grid gap-2">
                <div>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{selected.phone_number}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Headline</dt>
                  <dd>{selected.headline}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Experience</dt>
                  <dd>{selected.years_of_experience} years</dd>
                </div>
                {selected.languages_spoken?.length ? (
                  <div>
                    <dt className="text-muted-foreground">Languages</dt>
                    <dd>{selected.languages_spoken.join(", ")}</dd>
                  </div>
                ) : null}
                {selected.website_or_social ? (
                  <div>
                    <dt className="text-muted-foreground">Website / social</dt>
                    <dd className="break-all">{selected.website_or_social}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground">Motivation</dt>
                  <dd className="whitespace-pre-wrap leading-relaxed">{selected.motivation}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as CoachApplicationStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Admin notes</Label>
                <Textarea
                  rows={4}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Internal notes (not visible to applicant)"
                />
              </div>

              <Button onClick={saveDetail} disabled={updateMut.isPending}>
                {updateMut.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
