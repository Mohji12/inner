import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAdminAnnouncement,
  fetchAdminAnnouncements,
  fetchAdminMentors,
  fetchAdminUsers,
} from "@/api/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

type TargetGroup = "coach" | "user";
type AudienceScope = "all" | "one";

export default function AdminAnnouncementsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [targetGroup, setTargetGroup] = useState<TargetGroup>("coach");
  const [audience, setAudience] = useState<AudienceScope>("all");
  const [mentorId, setMentorId] = useState("");
  const [userId, setUserId] = useState("");
  const [pickerQuery, setPickerQuery] = useState("");

  const listQ = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: () => fetchAdminAnnouncements(0, 50),
  });

  const mentorsQ = useQuery({
    queryKey: ["admin", "mentors", "announcement-picker", pickerQuery],
    queryFn: () => fetchAdminMentors(0, 100, pickerQuery.trim() || undefined),
    enabled: targetGroup === "coach" && audience === "one",
  });

  const usersQ = useQuery({
    queryKey: ["admin", "users", "announcement-picker", pickerQuery],
    queryFn: () => fetchAdminUsers(0, 100, pickerQuery.trim() || undefined),
    enabled: targetGroup === "user" && audience === "one",
  });

  const selectedCoach = useMemo(
    () => (mentorsQ.data?.items ?? []).find((m) => m.id === mentorId) ?? null,
    [mentorsQ.data, mentorId],
  );

  const selectedUser = useMemo(
    () => (usersQ.data?.items ?? []).find((u) => u.id === userId) ?? null,
    [usersQ.data, userId],
  );

  const createMut = useMutation({
    mutationFn: () =>
      createAdminAnnouncement({
        title: title.trim(),
        body: body.trim(),
        send_email: sendEmail,
        audience: targetGroup,
        mentor_id: targetGroup === "coach" && audience === "one" ? mentorId : null,
        user_id: targetGroup === "user" && audience === "one" ? userId : null,
      }),
    onSuccess: (row) => {
      const emails = row.emails_sent ?? 0;
      const recipients = row.recipient_count ?? 0;
      if (sendEmail && emails === 0) {
        toast.error(
          d.announcementEmailFailed.replace(
            "{detail}",
            row.email_warning || d.announcementFailed,
          ),
        );
      } else if (sendEmail && emails < recipients) {
        toast.warning(
          (row.email_warning
            ? `${d.announcementEmailPartial} ${row.email_warning}`
            : d.announcementEmailPartial)
            .replace("{emails}", String(emails))
            .replace("{recipients}", String(recipients)),
        );
      } else if (audience === "one") {
        const name =
          targetGroup === "coach"
            ? selectedCoach?.full_name ?? ""
            : selectedUser?.full_name ?? "";
        toast.success(
          d.announcementSentOne.replace("{name}", name).replace("{emails}", String(emails)),
        );
      } else {
        const sentTpl =
          targetGroup === "user" ? d.announcementSentUsers : d.announcementSent;
        toast.success(
          sentTpl.replace("{recipients}", String(recipients)).replace("{emails}", String(emails)),
        );
      }
      setTitle("");
      setBody("");
      setMentorId("");
      setUserId("");
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
    if (audience === "one" && targetGroup === "coach" && !mentorId) {
      toast.error(d.announcementCoachRequired);
      return;
    }
    if (audience === "one" && targetGroup === "user" && !userId) {
      toast.error(d.announcementUserRequired);
      return;
    }
    createMut.mutate();
  };

  const switchTargetGroup = (next: TargetGroup) => {
    setTargetGroup(next);
    setAudience("all");
    setMentorId("");
    setUserId("");
    setPickerQuery("");
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
              <Legend className="text-sm font-medium">{d.announcementTargetGroup}</Legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="target-group"
                    checked={targetGroup === "coach"}
                    onChange={() => switchTargetGroup("coach")}
                    className="h-4 w-4"
                  />
                  {d.announcementTargetCoaches}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="target-group"
                    checked={targetGroup === "user"}
                    onChange={() => switchTargetGroup("user")}
                    className="h-4 w-4"
                  />
                  {d.announcementTargetUsers}
                </label>
              </div>
            </fieldset>

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
                      setUserId("");
                    }}
                    className="h-4 w-4"
                  />
                  {targetGroup === "user"
                    ? d.announcementAudienceAllUsers
                    : d.announcementAudienceAll}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="audience"
                    checked={audience === "one"}
                    onChange={() => setAudience("one")}
                    className="h-4 w-4"
                  />
                  {targetGroup === "user"
                    ? d.announcementAudienceOneUser
                    : d.announcementAudienceOne}
                </label>
              </div>
            </fieldset>

            {audience === "one" && targetGroup === "coach" ? (
              <div className="space-y-2">
                <Label htmlFor="announcement-coach-search">{d.announcementSelectCoach}</Label>
                <Input
                  id="announcement-coach-search"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
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

            {audience === "one" && targetGroup === "user" ? (
              <div className="space-y-2">
                <Label htmlFor="announcement-user-search">{d.announcementSelectUser}</Label>
                <Input
                  id="announcement-user-search"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={d.announcementSelectUserPlaceholder}
                />
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                >
                  <option value="">{d.announcementSelectUserPlaceholder}</option>
                  {(usersQ.data?.items ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} — {u.email}
                    </option>
                  ))}
                </select>
                {selectedUser ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedUser.full_name} · {selectedUser.email}
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
                placeholder={
                  targetGroup === "user"
                    ? d.announcementBodyPlaceholderUsers
                    : d.announcementBodyPlaceholder
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="h-4 w-4 rounded border"
              />
              {audience === "one"
                ? targetGroup === "user"
                  ? d.announcementSendEmailOneUser
                  : d.announcementSendEmailOne
                : targetGroup === "user"
                  ? d.announcementSendEmailUsers
                  : d.announcementSendEmail}
            </label>
            <Button type="submit" className="gradient-cta text-white" disabled={createMut.isPending}>
              {createMut.isPending
                ? d.announcementSending
                : audience === "one"
                  ? targetGroup === "user"
                    ? d.announcementSubmitOneUser
                    : d.announcementSubmitOne
                  : targetGroup === "user"
                    ? d.announcementSubmitUsers
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
                <TableHead>{d.announcementColAudience}</TableHead>
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
                  <TableCell className="text-sm">
                    {(row.audience || "coach") === "user"
                      ? d.announcementTargetUsers
                      : d.announcementTargetCoaches}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                      {row.body}
                    </p>
                  </TableCell>
                  <TableCell>{row.recipient_count}</TableCell>
                  <TableCell>{row.emails_sent}</TableCell>
                </TableRow>
              ))}
              {!listQ.isLoading && (listQ.data?.items?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
