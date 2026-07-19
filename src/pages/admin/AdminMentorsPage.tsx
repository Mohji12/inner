import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminMentor,
  fetchAdminMentors,
  getAdminMentorPayoutBankDetails,
  updateMentorApproval,
} from "@/api/admin";
import type { AdminMentorBankDetailsPrivate, AdminMentorRow } from "@/api/admin";
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
import { unknownListToStrings } from "@/lib/dbJsonFields";
import { mediaUrlFromApi } from "@/lib/mediaUrl";
import { useLanguage } from "@/i18n/LanguageContext";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

function formatList(value: unknown[] | null | undefined): string {
  const items = unknownListToStrings(value);
  return items.length ? items.join(", ") : "—";
}

function formatMoney(value: string | number | null | undefined, currency = "EUR"): string {
  if (value == null || value === "") return "—";
  return `${value} ${currency}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value || "—"}</dd>
    </div>
  );
}

export default function AdminMentorsPage() {
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState("");
  const [bankMentorId, setBankMentorId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<AdminMentorBankDetailsPrivate | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [profileMentorId, setProfileMentorId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "mentors", limit, q],
    queryFn: () => fetchAdminMentors(0, limit, q.trim() || undefined),
  });

  const profileQ = useQuery({
    queryKey: ["admin", "mentor-detail", profileMentorId],
    queryFn: () => fetchAdminMentor(profileMentorId!),
    enabled: Boolean(profileMentorId),
  });

  const approvalMut = useMutation({
    mutationFn: ({ mentorId, action, reason }: { mentorId: string; action: "approve" | "reject"; reason?: string }) =>
      updateMentorApproval(mentorId, { action, reason }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "approve" ? d.mentorApproved : d.mentorRejected);
      queryClient.invalidateQueries({ queryKey: ["admin", "mentors"] });
      if (profileMentorId) {
        void queryClient.invalidateQueries({ queryKey: ["admin", "mentor-detail", profileMentorId] });
      }
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
      toast.error(e instanceof Error ? e.message : d.bankLoadError);
      setBankMentorId(null);
    } finally {
      setBankLoading(false);
    }
  };

  if (isLoading || !data) {
    return <p className="text-muted-foreground">{d.tableLoading}</p>;
  }

  const profile: AdminMentorRow | null = profileQ.data ?? null;
  const profileImg = profile?.profile_image ? mediaUrlFromApi(profile.profile_image) : null;
  const bannerImg = profile?.banner_image ? mediaUrlFromApi(profile.banner_image) : null;

  return (
    <Card className="border-border/60 glass-card">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{d.mentors}</CardTitle>
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
              <TableHead>{d.name}</TableHead>
              <TableHead>{d.email}</TableHead>
              <TableHead>{d.phone}</TableHead>
              <TableHead>{d.company}</TableHead>
              <TableHead>{d.kvk}</TableHead>
              <TableHead>{d.status}</TableHead>
              <TableHead>{d.approved}</TableHead>
              <TableHead>{d.created}</TableHead>
              <TableHead>{d.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.full_name}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.phone_number || "—"}</TableCell>
                <TableCell className="max-w-[140px] truncate">{m.current_company || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{m.kvk_number || "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{m.status}</Badge>
                </TableCell>
                <TableCell>{m.is_approved ? d.yes : d.no}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setProfileMentorId(m.id)}>
                      {d.viewProfile}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void openBankDetails(m.id)}>
                      {d.bankDetails}
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

      <Dialog open={Boolean(profileMentorId)} onOpenChange={(open) => !open && setProfileMentorId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif">{d.coachProfileTitle}</DialogTitle>
            <DialogDescription>{d.coachProfileDesc}</DialogDescription>
          </DialogHeader>
          {profileQ.isLoading ? (
            <p className="text-sm text-muted-foreground">{d.tableLoading}</p>
          ) : profileQ.isError ? (
            <p className="text-sm text-destructive">{d.errorGeneric}</p>
          ) : profile ? (
            <div className="space-y-4">
              {(bannerImg || profileImg) && (
                <div className="space-y-2">
                  {bannerImg ? (
                    <img src={bannerImg} alt="" className="h-28 w-full rounded-lg object-cover" />
                  ) : null}
                  {profileImg ? (
                    <img
                      src={profileImg}
                      alt={profile.full_name}
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
                    />
                  ) : null}
                </div>
              )}
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <DetailField label={d.fullName} value={profile.full_name} />
                <DetailField label={d.email} value={profile.email} />
                <DetailField label={d.phone} value={profile.phone_number} />
                <DetailField label={d.company} value={profile.current_company} />
                <DetailField label={d.kvk} value={profile.kvk_number} />
                <DetailField label={d.country} value={profile.country_code} />
                <DetailField label={d.timezone} value={profile.timezone} />
                <DetailField label={d.yearsExperience} value={profile.years_of_experience} />
                <DetailField
                  label={d.rating}
                  value={`${profile.average_rating ?? 0} · ${d.reviewsCount.replace("{count}", String(profile.total_reviews ?? 0))}`}
                />
                <DetailField label={d.sessionsCompleted} value={profile.total_sessions_completed ?? 0} />
                <DetailField label={d.status} value={profile.status} />
                <DetailField label={d.approved} value={profile.is_approved ? d.yes : d.no} />
                <DetailField label={d.emailVerified} value={profile.email_verified ? d.yes : d.no} />
                <DetailField label={d.platformVerified} value={profile.is_verified ? d.yes : d.no} />
                <DetailField label={d.twoFactor} value={profile.is_totp_enabled ? d.yes : d.no} />
                <DetailField label={d.googleLinked} value={profile.has_google_id ? d.yes : d.no} />
                <DetailField label={d.price10} value={formatMoney(profile.price_10_min)} />
                <DetailField label={d.price20} value={formatMoney(profile.price_20_min)} />
                <DetailField label={d.price30} value={formatMoney(profile.price_30_min)} />
                <DetailField
                  label={d.chatPrice}
                  value={formatMoney(profile.chat_price_per_minute, profile.chat_currency ?? "EUR")}
                />
                <DetailField label={d.chatCurrency} value={profile.chat_currency} />
                <DetailField label={d.chatMinMinutes} value={profile.chat_min_purchase_minutes} />
                <DetailField label={d.agreementVersion} value={profile.agreement_version} />
                <DetailField label={d.agreementAccepted} value={formatDate(profile.agreement_accepted_at)} />
                <DetailField label={d.lastSeen} value={formatDate(profile.last_seen_at)} />
                <DetailField label={d.presenceAccrued} value={formatDate(profile.presence_accrued_at)} />
                <DetailField label={d.deactivatedAt} value={formatDate(profile.deactivated_at)} />
                <div className="sm:col-span-2">
                  <DetailField label={d.headline} value={profile.headline} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.bio} value={profile.bio} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.languages} value={formatList(profile.languages_spoken)} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.expertise} value={formatList(profile.expertise_areas)} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.skills} value={formatList(profile.skills)} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.education} value={formatList(profile.education)} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.certifications} value={formatList(profile.certifications)} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.tools} value={formatList(profile.tools_technologies)} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.sessionModes} value={formatList(profile.session_modes)} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.previousCompanies} value={formatList(profile.previous_companies)} />
                </div>
                <DetailField label={d.created} value={formatDate(profile.created_at)} />
                <DetailField label={d.updated} value={formatDate(profile.updated_at)} />
                <div className="sm:col-span-2">
                  <DetailField label={d.profileImage} value={profile.profile_image} />
                </div>
                <div className="sm:col-span-2">
                  <DetailField label={d.bannerImage} value={profile.banner_image} />
                </div>
              </dl>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(bankMentorId)} onOpenChange={(open) => !open && setBankMentorId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">{d.bankDetailsTitle}</DialogTitle>
            <DialogDescription>{d.bankDetailsDesc}</DialogDescription>
          </DialogHeader>
          {bankLoading ? (
            <p className="text-sm text-muted-foreground">{d.tableLoading}</p>
          ) : bankDetails?.has_bank_details ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">{d.accountHolder}</dt>
                <dd className="font-medium">{bankDetails.account_holder_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{d.iban}</dt>
                <dd className="font-mono">{bankDetails.iban ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{d.bic}</dt>
                <dd className="font-mono">{bankDetails.bic ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{d.status}</dt>
                <dd>{bankDetails.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{d.provider}</dt>
                <dd>{bankDetails.provider_name || "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{d.noBankDetails}</p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
