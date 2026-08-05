import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdminAnnouncement, fetchAdminAnnouncements, fetchAdminMentors } from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

type Audience = "all" | "one";

export default function AdminAnnouncementsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [audience, setAudience] = useState<Audience>("all");
  const [mentorId, setMentorId] = useState("");
  const [coachQuery, setCoachQuery] = useState("");

  const listQ = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: () => fetchAdminAnnouncements(0, 50),
  });

  const mentorsQ = useQuery({
    queryKey: ["admin", "mentors", "announcement-picker", coachQuery],
    queryFn: () => fetchAdminMentors(0, 100, coachQuery.trim() || undefined),
    enabled: audience === "one",
  });

  const selectedCoach = useMemo(
    () => (mentorsQ.data?.items ?? []).find((m) => m.id === mentorId) ?? null,
    [mentorsQ.data, mentorId],
  );

  const createMut = useMutation({
    mutationFn: () =>
      createAdminAnnouncement({
        title: title.trim(),
        body: body.trim(),
        send_email: sendEmail,
        mentor_id: audience === "one" ? mentorId : null,
      }),
    onSuccess: (row) => {
      if (audience === "one" && selectedCoach) {
        toast.success(
          d.announcementSentOne
            .replace("{name}", selectedCoach.full_name)
            .replace("{emails}", String(row.emails_sent)),
        );
      } else {
        toast.success(
          d.announcementSent
            .replace("{recipients}", String(row.recipient_count))
            .replace("{emails}", String(row.emails_sent)),
        );
      }
      setTitle("");
      setBody("");
      setMentorId("");
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
    if (audience === "one" && !mentorId) {
      toast.error(d.announcementCoachRequired);
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
            <fieldset className="space-y-2">
              <Legend className="text-sm font-medium">{d.announcementAudience}</Legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === "all"}
                    onChange={() => {
                      setAudience("all");
                      setMentorId("");
                    }}
                    className="h-4 w-4"
                  />
                  {d.announcementAudienceAll}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === "one"}
                    onChange={() => setAudience("one")}
                    className="h-4 w-4"
                  />
                  {d.announcementAudienceOne}
                </label>
              </div>
            </fieldset>

            {audience === "one" ? (
              <div className="space-y-2">
                <Label htmlFor="announcement-coach-search">{d.announcementSelectCoach}</Label>
                <Input
                  id="announcement-coach-search"
                  value={coachQuery}
                  onChange={(e) => setCoachQuery(e.target.value)}
                  placeholder={d.announcementSelectCoachPlaceholder}
                />
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={mentorId}
                  onChange={(e) => setMentorId(e.target.value)}
                  required
                >
                  <option value="">{d.announcementSelectCoachPlaceholder}</option>
                  {(mentorsQ.data?.items ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} — {m.email}
                    </option>
                  ))}
                </select>
                {selectedCoach ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedCoach.full_name} · {selectedCoach.email}
                  </p>
                ) : null}
              </div>
            ) : null}

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
              {audience === "one" ? d.announcementSendEmailOne : d.announcementSendEmail}
            </label>
            <Button type="submit" className="gradient-cta text-white" disabled={createMut.isPending}>
              {createMut.isPending
                ? d.announcementSending
                : audience === "one"
                  ? d.announcementSubmitOne
                  : d.announcementSubmit}
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

function Legend({ className, children }: { className?: string; children: ReactNode }) {
  return <legend className={className}>{children}</legend>;
}
