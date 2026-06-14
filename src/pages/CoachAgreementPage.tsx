import { FormEvent, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/auth/AuthContext";
import { acceptCoachAgreement, getMentorMe } from "@/api/mentors";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  COACH_AGREEMENT_TEXT,
  COACH_AGREEMENT_VERSION,
  readCoachAgreementAcceptance,
  saveCoachAgreementAcceptance,
} from "@/lib/coachAgreement";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function CoachAgreementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, mentorAccessToken } = useAuth();
  const { t } = useLanguage();
  const p = t.app.coachAgreementPage;

  const isMentor = role === "mentor" && !!mentorAccessToken;

  const mentorQuery = useQuery({
    queryKey: ["mentor-me"],
    queryFn: getMentorMe,
    enabled: isMentor,
  });

  const [accepted, setAccepted] = useState(false);
  const [signatureName, setSignatureName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [guestAccepted, setGuestAccepted] = useState(() => readCoachAgreementAcceptance());

  useEffect(() => {
    const stored = readCoachAgreementAcceptance();
    if (stored) {
      setGuestAccepted(stored);
      setAccepted(true);
      setSignatureName(stored.signatureName);
    }
  }, []);

  useEffect(() => {
    const mentor = mentorQuery.data;
    if (!mentor?.full_name) return;
    setSignatureName((prev) => prev || mentor.full_name);
  }, [mentorQuery.data]);

  const alreadySignedOnServer =
    isMentor &&
    !!mentorQuery.data?.agreement_accepted_at &&
    mentorQuery.data.agreement_version === COACH_AGREEMENT_VERSION;

  const signedAt =
    mentorQuery.data?.agreement_accepted_at ?? guestAccepted?.acceptedAt ?? null;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accepted) {
      toast.error(p.errMustAccept);
      return;
    }
    const name = signatureName.trim();
    if (name.length < 2) {
      toast.error(p.errSignature);
      return;
    }

    setSubmitting(true);
    try {
      if (isMentor) {
        await acceptCoachAgreement({
          signature_name: name,
          agreement_version: COACH_AGREEMENT_VERSION,
          agreement_text_snapshot: COACH_AGREEMENT_TEXT,
        });
        await queryClient.invalidateQueries({ queryKey: ["mentor-me"] });
        toast.success(p.toastSigned);
      } else {
        saveCoachAgreementAcceptance(name);
        setGuestAccepted(readCoachAgreementAcceptance());
        toast.success(p.toastSaved);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : p.errFailed;
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const showForm = !alreadySignedOnServer && !guestAccepted;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto flex-1 px-6 pb-10 pt-32 md:pt-40 lg:pt-44">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {p.back}
          </Button>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="min-w-0">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-2xl">Coach Agreement</CardTitle>
                <CardDescription>{p.footerNote}</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[min(70vh,640px)] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-muted/20 p-5 text-sm leading-6">
                  {COACH_AGREEMENT_TEXT}
                </pre>
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 lg:sticky lg:top-36">
            {(alreadySignedOnServer || guestAccepted) && signedAt ? (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-medium text-emerald-900 dark:text-emerald-100">{p.alreadySigned}</p>
                      <p className="mt-1 text-muted-foreground">
                        {p.signedOn.replace("{date}", new Date(signedAt).toLocaleString())}
                      </p>
                      {!isMentor && guestAccepted && (
                        <Button asChild className="mt-4" variant="outline">
                          <Link to="/mentor/register">{p.continueRegister}</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : showForm ? (
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle>{p.signTitle}</CardTitle>
                  <CardDescription>{p.signDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={onSubmit}>
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-border"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                      />
                      <span>{p.acceptLabel}</span>
                    </label>

                    <div className="space-y-2">
                      <Label htmlFor="signature-name">{p.signatureLabel}</Label>
                      <Input
                        id="signature-name"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        placeholder={p.signaturePlaceholder}
                        autoComplete="name"
                      />
                      <p className="text-xs text-muted-foreground">{p.signatureHint}</p>
                    </div>

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
                      <Button type="submit" disabled={submitting || !accepted} className="sm:flex-1">
                        {submitting ? p.submitting : p.submit}
                      </Button>
                      {!isMentor && (
                        <Button type="button" variant="outline" asChild className="sm:flex-1">
                          <Link to="/mentor/register">{p.continueRegister}</Link>
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            <p className="mt-4 text-xs text-muted-foreground">
              {p.version}: {COACH_AGREEMENT_VERSION}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
