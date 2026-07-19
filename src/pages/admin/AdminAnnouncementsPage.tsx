import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdminAnnouncement, fetchAdminAnnouncements } from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

export default function AdminAnnouncementsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const listQ = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: () => fetchAdminAnnouncements(0, 50),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createAdminAnnouncement({
        title: title.trim(),
        body: body.trim(),
        send_email: sendEmail,
      }),
    onSuccess: (row) => {
      toast.success(
        d.announcementSent
          .replace("{recipients}", String(row.recipient_count))
          .replace("{emails}", String(row.emails_sent)),
      );
      setTitle("");
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
    onError: (e: Error) => toast.error(e.message || d.announcementFailed),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error(d.announcementRequired);
      return;
    }
    createMut.mutate();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-serif text-3xl">{d.announcements}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{d.announcementsDescription}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{d.announcementCompose}</CardTitle>
          <CardDescription>{d.announcementComposeHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="announcement-title">{d.announcementTitle}</Label>
              <Input
                id="announcement-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={255}
                placeholder={d.announcementTitlePlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-body">{d.announcementBody}</Label>
              <Textarea
                id="announcement-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder={d.announcementBodyPlaceholder}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              {d.announcementSendEmail}
            </label>
            <Button type="submit" className="gradient-cta text-white" disabled={createMut.isPending}>
              {createMut.isPending ? d.announcementSending : d.announcementSubmit}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{d.announcementHistory}</CardTitle>
          <CardDescription>
            {listQ.isLoading
              ? d.tableLoading
              : d.announcementHistoryTotal.replace("{count}", String(listQ.data?.total ?? 0))}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{d.announcementColDate}</TableHead>
                <TableHead>{d.announcementTitle}</TableHead>
                <TableHead>{d.announcementColRecipients}</TableHead>
                <TableHead>{d.announcementColEmails}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(listQ.data?.items ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{row.body}</p>
                  </TableCell>
                  <TableCell>{row.recipient_count}</TableCell>
                  <TableCell>{row.emails_sent}</TableCell>
                </TableRow>
              ))}
              {!listQ.isLoading && (listQ.data?.items?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {d.announcementEmpty}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
