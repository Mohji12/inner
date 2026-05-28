import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminMentors, getAdminMentorPayoutBankDetails, updateMentorApproval } from "@/api/admin";
import type { AdminMentorBankDetailsPrivate } from "@/api/admin";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminMentorsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState("");
  const [bankMentorId, setBankMentorId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<AdminMentorBankDetailsPrivate | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "mentors", limit, q],
    queryFn: () => fetchAdminMentors(0, limit, q.trim() || undefined),
  });

  const approvalMut = useMutation({
    mutationFn: ({ mentorId, action, reason }: { mentorId: string; action: "approve" | "reject"; reason?: string }) =>
      updateMentorApproval(mentorId, { action, reason }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "approve" ? d.mentorApproved : d.mentorRejected);
      queryClient.invalidateQueries({ queryKey: ["admin", "mentors"] });
    },
    onError: (e: Error) => toast.error(e.message || d.mentorApprovalFailed),
  });

  const onApprove = (mentorId: string) => {
    approvalMut.mutate({ mentorId, action: "approve" });
  };

  const onReject = (mentorId: string) => {
    const reason = window.prompt(d.mentorRejectPrompt) || undefined;
    approvalMut.mutate({ mentorId, action: "reject", reason });
  };

  const openBankDetails = async (mentorId: string) => {
    setBankMentorId(mentorId);
    setBankLoading(true);
    setBankDetails(null);
    try {
      const details = await getAdminMentorPayoutBankDetails(mentorId);
      setBankDetails(details);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load bank details");
      setBankMentorId(null);
    } finally {
      setBankLoading(false);
    }
  };

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.mentors}</CardTitle>
        <CardDescription>
          {data.total} total · showing {data.items.length}
        </CardDescription>
        <div className="max-w-sm pt-2">
          <Input
            placeholder="Search email or name"
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Headline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Email verified</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.full_name}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell className="max-w-[200px] truncate">{m.headline ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{m.status}</Badge>
                </TableCell>
                <TableCell>{m.is_approved ? "Yes" : "No"}</TableCell>
                <TableCell>{m.email_verified ? "Yes" : "No"}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void openBankDetails(m.id)}>
                      Bank details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={approvalMut.isPending || (m.is_approved && m.status === "active")}
                      onClick={() => onApprove(m.id)}
                    >
                      {d.approve}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={approvalMut.isPending || m.status === "rejected"}
                      onClick={() => onReject(m.id)}
                    >
                      {d.reject}
                    </Button>
                  </div>
                </TableCell>
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

      <Dialog open={Boolean(bankMentorId)} onOpenChange={(open) => !open && setBankMentorId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Coach bank details</DialogTitle>
            <DialogDescription>Payout account information submitted by the coach</DialogDescription>
          </DialogHeader>
          {bankLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : bankDetails?.has_bank_details ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Account holder</dt>
                <dd className="font-medium">{bankDetails.account_holder_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">IBAN</dt>
                <dd className="font-mono">{bankDetails.iban ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">BIC</dt>
                <dd className="font-mono">{bankDetails.bic ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{bankDetails.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd>{bankDetails.provider_name || "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No bank details on file for this coach.</p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
