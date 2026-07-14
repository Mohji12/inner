import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { registerMentor, resendMentorVerifyEmail, verifyMentorEmail } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { uploadRegistrationMentorAvatar } from "@/api/uploads";
import { commaSeparatedToStringList } from "@/lib/dbJsonFields";
import CoachCardVisibilityPicker from "@/components/CoachCardVisibilityPicker";
import { DEFAULT_COACH_CARD_VISIBILITY, type CoachCardVisibility } from "@/lib/coachCardVisibility";
import { COACH_AGREEMENT_TEXT, COACH_AGREEMENT_VERSION, readCoachAgreementAcceptance } from "@/lib/coachAgreement";
import SpokenLanguageCheckboxGroup from "@/components/SpokenLanguageCheckboxGroup";

const TAB_ORDER = ["account", "profile", "background"] as const;
type TabId = (typeof TAB_ORDER)[number];
type Phase = "form" | "verify";

const MentorRegisterPage = () => {
  const navigate = useNavigate();
  const { loginMentorSession } = useAuth();
  const { t, htmlLang } = useLanguage();
  const m = t.app.mentorRegister;
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [otp, setOtp] = useState("");
  const [verifyCtx, setVerifyCtx] = useState<{ email: string; password: string; mentorId: string } | null>(null);
  const [tab, setTab] = useState<TabId>("account");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementAcceptedBeforeVerify, setAgreementAcceptedBeforeVerify] = useState(false);
  const pendingAvatarFileRef = useRef<File | null>(null);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [cardVisibility, setCardVisibility] = useState<CoachCardVisibility>(DEFAULT_COACH_CARD_VISIBILITY);

  useEffect(() => {
    return () => {
      if (localAvatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(localAvatarPreview);
      }
    };
  }, [localAvatarPreview]);

  useEffect(() => {
    const stored = readCoachAgreementAcceptance();
    if (!stored) return;
    setAgreementAccepted(true);
    setAgreementAcceptedBeforeVerify(true);
    setFormData((prev) => ({
      ...prev,
      name: prev.name || stored.signatureName,
    }));
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    headline: "",
    expertiseAreasCsv: "",
    bio: "",
    profileImage: "",
    spokenLanguages: [] as string[],
    companyName: "",
    kvkNumber: "",
    educationCsv: "",
    certificationsCsv: "",
    skillsCsv: "",
    toolsCsv: "",
    sessionModesCsv: "",
    yearsExperience: "3",
  });

  const tabIndex = TAB_ORDER.indexOf(tab);
  const goNext = () => {
    if (tabIndex < TAB_ORDER.length - 1) setTab(TAB_ORDER[tabIndex + 1]);
  };
  const goPrev = () => {
    if (tabIndex > 0) setTab(TAB_ORDER[tabIndex - 1]);
  };

  const stepLabel = m.stepOf.replace("{current}", String(tabIndex + 1)).replace("{total}", String(TAB_ORDER.length));

  const finishRegistration = (message?: string, mentorId?: string) => {
    const params = new URLSearchParams();
    if (mentorId) {
      params.set("mentorId", mentorId);
    }
    const finalMessage = (message ?? m.successFreeRedirect).trim();
    if (finalMessage) {
      params.set("message", finalMessage);
    }
    const query = params.toString();
    navigate(`/mentor/register/thank-you${query ? `?${query}` : ""}`);
  };

  const completeMentorOnboarding = async (email: string, password: string, message?: string, mentorId?: string) => {
    try {
      await loginMentorSession({ email, password });
    } catch {
      // Still land on thank-you; redirect falls back to login if no session.
    }
    finishRegistration(message, mentorId);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      setError(m.errAccount);
      return;
    }
    if (formData.password.length < 8) {
      setError(m.errPassword);
      return;
    }
    if (!formData.headline.trim() || !formData.bio.trim()) {
      setError(m.errHeadlineBio);
      return;
    }
    if (!agreementAccepted) {
      setError(m.errAgreementRequired);
      return;
    }

    try {
      const email = formData.email.trim();
      const pendingFile = pendingAvatarFileRef.current;
      const urlOnly = formData.profileImage.trim();
      const reg = await registerMentor({
        full_name: formData.name.trim(),
        email,
        phone_number: formData.phone.trim(),
        password: formData.password,
        headline: formData.headline.trim(),
        bio: formData.bio.trim() || null,
        profile_image: pendingFile ? null : urlOnly ? urlOnly : null,
        current_company: formData.companyName.trim() || null,
        kvk_number: formData.kvkNumber.trim() || null,
        languages_spoken: formData.spokenLanguages.length ? formData.spokenLanguages : null,
        years_of_experience: Number(formData.yearsExperience) || 0,
        expertise_areas: commaSeparatedToStringList(formData.expertiseAreasCsv) || null,
        skills: commaSeparatedToStringList(formData.skillsCsv) || null,
        education: commaSeparatedToStringList(formData.educationCsv) || null,
        certifications: commaSeparatedToStringList(formData.certificationsCsv) || null,
        tools_technologies: commaSeparatedToStringList(formData.toolsCsv) || null,
        session_modes: commaSeparatedToStringList(formData.sessionModesCsv) || null,
        public_card_visibility: cardVisibility,
        agreement_accepted: true,
        agreement_version: COACH_AGREEMENT_VERSION,
        agreement_text_snapshot: COACH_AGREEMENT_TEXT,
      });
      pendingAvatarFileRef.current = null;

      if (pendingFile) {
        try {
          const uploadedUrl = await uploadRegistrationMentorAvatar({
            email,
            password: formData.password,
            file: pendingFile,
          });
          setFormData((prev) => ({ ...prev, profileImage: uploadedUrl }));
          if (localAvatarPreview?.startsWith("blob:")) {
            URL.revokeObjectURL(localAvatarPreview);
          }
          setLocalAvatarPreview(null);
          toast.success(m.toastPhotoOk);
        } catch (e) {
          const msg =
            e instanceof Error ? e.message : m.toastPhotoFail;
          toast.error(msg);
        }
      }
      if (reg.dev_verification_code) {
        const verified = await verifyMentorEmail({ email, code: reg.dev_verification_code });
        await completeMentorOnboarding(
          email,
          formData.password,
          verified.message,
          verified.mentor_id || reg.id,
        );
        return;
      }
      setVerifyCtx({ email, password: formData.password, mentorId: reg.id });
      setOtp("");
      setPhase("verify");
      setAgreementAcceptedBeforeVerify(false);
      toast.message(m.verifyDescription);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : m.errFailed;
      setError(msg);
      toast.error(msg);
    }
  };

  const onVerifyOtp = async () => {
    if (!verifyCtx || otp.replace(/\D/g, "").length !== 6) {
      setError(m.errVerify);
      return;
    }
    if (!agreementAcceptedBeforeVerify) {
      setError(m.errAgreementVerify);
      return;
    }
    setError("");
    try {
      const verified = await verifyMentorEmail({ email: verifyCtx.email, code: otp.replace(/\D/g, "") });
      await completeMentorOnboarding(
        verifyCtx.email,
        verifyCtx.password,
        verified.message,
        verified.mentor_id || verifyCtx.mentorId,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : m.errVerify;
      setError(msg);
      toast.error(msg);
    }
  };

  const onResendOtp = async () => {
    if (!verifyCtx) return;
    try {
      await resendMentorVerifyEmail(verifyCtx.email);
      toast.message(m.resendToast);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : m.errFailed;
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" lang={htmlLang}>
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-4xl border-border/60">
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{m.title}</CardTitle>
            <CardDescription>
              {m.description}{" "}
              <Link to="/become-a-coach" className="text-accent underline underline-offset-4">
                {t.app.header.becomeCoach}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phase === "verify" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="font-serif text-xl">{m.verifyTitle}</h3>
                  <p className="text-sm text-muted-foreground">{m.verifyDescription}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp">{m.otpLabel}</Label>
                  <InputOTP
                    id="otp"
                    maxLength={6}
                    value={otp}
                    onChange={setOtp}
                    containerClassName="justify-start"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-foreground">
                  {m.onboardingFreeNote}
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={agreementAcceptedBeforeVerify}
                      onChange={(e) => setAgreementAcceptedBeforeVerify(e.target.checked)}
                    />
                    <span>
                      {m.verifyAgreementBeforeLink}
                      <Link to="/coach-agreement" className="text-accent underline underline-offset-4">
                        {m.coachAgreementLink}
                      </Link>
                      {m.verifyAgreementAfterLink}
                    </span>
                  </label>
                </div>
                {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPhase("form");
                      setVerifyCtx(null);
                      setOtp("");
                      setError("");
                    }}
                  >
                    {m.back}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void onResendOtp()}>
                    {m.resendCode}
                  </Button>
                  <Button type="button" className="gradient-cta text-white" onClick={() => void onVerifyOtp()}>
                    {m.verifySubmit}
                  </Button>
                </div>
              </div>
            ) : (
            <form lang={htmlLang} onSubmit={(e) => void onSubmit(e)} className="space-y-6">
              <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-3">
                  <TabsTrigger value="account" className="text-xs sm:text-sm">
                    {m.tabAccount}
                  </TabsTrigger>
                  <TabsTrigger value="profile" className="text-xs sm:text-sm">
                    {m.tabProfile}
                  </TabsTrigger>
                  <TabsTrigger value="background" className="text-xs sm:text-sm">
                    {m.tabBackground}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="account" className="mt-6 space-y-4">
                  <p className="text-sm text-muted-foreground">{m.accountHint}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="name">{m.fullName}</Label>
                      <Input
                        id="name"
                        lang={htmlLang}
                        spellCheck
                        autoComplete="name"
                        value={formData.name}
                        onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{m.email}</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={formData.email}
                        onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{m.phone}</Label>
                      <Input
                        id="phone"
                        autoComplete="tel"
                        value={formData.phone}
                        onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="password">{m.password}</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        value={formData.password}
                        onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                      />
                      <PasswordStrengthMeter password={formData.password} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="profile" className="mt-6 space-y-4">
                  <p className="text-sm text-muted-foreground">{m.profileHint}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="pimg-upload">{m.profileImage}</Label>
                      {m.profileImageHint ? (
                        <p className="text-xs text-muted-foreground">{m.profileImageHint}</p>
                      ) : null}
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        {formData.profileImage || localAvatarPreview ? (
                          <img
                            src={localAvatarPreview || formData.profileImage}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 bg-muted/30 text-center text-[10px] text-muted-foreground">
                            {m.photoPreviewEmpty}
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <Input
                            id="pimg-upload"
                            type="file"
                            accept="image/*"
                            className="cursor-pointer file:cursor-pointer file:rounded-md file:border file:border-border file:bg-muted/50 file:px-2 file:text-sm file:font-medium"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (!file) return;
                              if (!formData.email.trim() || !formData.password) {
                                toast.message(m.toastFillAccountFirst);
                                return;
                              }
                              pendingAvatarFileRef.current = file;
                              if (localAvatarPreview?.startsWith("blob:")) {
                                URL.revokeObjectURL(localAvatarPreview);
                              }
                              setLocalAvatarPreview(URL.createObjectURL(file));
                            }}
                          />
                          <Label htmlFor="pimg-url" className="text-xs text-muted-foreground">
                            {m.orPasteImageUrl}
                          </Label>
                          <Input
                            id="pimg-url"
                            type="url"
                            placeholder="https://…"
                            value={formData.profileImage}
                            onChange={(event) => {
                              pendingAvatarFileRef.current = null;
                              if (localAvatarPreview?.startsWith("blob:")) {
                                URL.revokeObjectURL(localAvatarPreview);
                              }
                              setLocalAvatarPreview(null);
                              setFormData((prev) => ({ ...prev, profileImage: event.target.value }));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="headline">{m.headline}</Label>
                      <Input
                        id="headline"
                        lang={htmlLang}
                        spellCheck
                        placeholder={m.headlinePlaceholder}
                        value={formData.headline}
                        onChange={(event) => setFormData((prev) => ({ ...prev, headline: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="expertiseCsv">{m.expertiseCsv}</Label>
                      <Input
                        id="expertiseCsv"
                        lang={htmlLang}
                        spellCheck
                        placeholder={m.expertisePlaceholder}
                        value={formData.expertiseAreasCsv}
                        onChange={(event) => setFormData((prev) => ({ ...prev, expertiseAreasCsv: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="bio">{m.bio}</Label>
                      <Textarea
                        id="bio"
                        rows={4}
                        lang={htmlLang}
                        spellCheck
                        placeholder={m.bioPlaceholder}
                        value={formData.bio}
                        onChange={(event) => setFormData((prev) => ({ ...prev, bio: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="lang">{m.languages}</Label>
                      <SpokenLanguageCheckboxGroup
                        id="lang"
                        value={formData.spokenLanguages}
                        onChange={(spokenLanguages) => setFormData((prev) => ({ ...prev, spokenLanguages }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exp">{m.years}</Label>
                      <Input
                        id="exp"
                        type="number"
                        min={0}
                        value={formData.yearsExperience}
                        onChange={(event) => setFormData((prev) => ({ ...prev, yearsExperience: event.target.value }))}
                      />
                    </div>
                  </div>
                  <CoachCardVisibilityPicker
                    title={m.cardVisibilityTitle}
                    description={m.cardVisibilityDescription}
                    value={cardVisibility}
                    onChange={setCardVisibility}
                    labels={m.cardVisibilityFields}
                  />
                </TabsContent>

                <TabsContent value="background" className="mt-6 space-y-4">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={agreementAccepted}
                        onChange={(e) => setAgreementAccepted(e.target.checked)}
                      />
                      <span>
                        {m.agreementCheckboxBeforeLink}
                        <Link to="/coach-agreement" className="text-accent underline underline-offset-4">
                          {m.coachAgreementLink}
                        </Link>
                        {m.agreementCheckboxAfterLink}
                      </span>
                    </label>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {m.agreementProofNote}
                    </p>
                  </div>
                  <ul className="list-disc space-y-2 pl-5 text-sm font-bold leading-relaxed text-foreground">
                    {m.medicalGuidelines.map((guideline, index) => (
                      <li key={index}>{guideline}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground">{m.backgroundHint}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="company">{m.companyName}</Label>
                      <Input
                        id="company"
                        placeholder={m.phCompanyName}
                        value={formData.companyName}
                        onChange={(event) => setFormData((prev) => ({ ...prev, companyName: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="kvk">{m.kvkNumber}</Label>
                      <Input
                        id="kvk"
                        inputMode="numeric"
                        placeholder={m.phKvkNumber}
                        value={formData.kvkNumber}
                        onChange={(event) => setFormData((prev) => ({ ...prev, kvkNumber: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="edu">{m.education}</Label>
                      <Input
                        id="edu"
                        placeholder={m.phEducation}
                        value={formData.educationCsv}
                        onChange={(event) => setFormData((prev) => ({ ...prev, educationCsv: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="cert">{m.certifications}</Label>
                      <Input
                        id="cert"
                        placeholder={m.phCert}
                        value={formData.certificationsCsv}
                        onChange={(event) => setFormData((prev) => ({ ...prev, certificationsCsv: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="skills">{m.skills}</Label>
                      <Input
                        id="skills"
                        placeholder={m.phSkills}
                        value={formData.skillsCsv}
                        onChange={(event) => setFormData((prev) => ({ ...prev, skillsCsv: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="tools">{m.tools}</Label>
                      <Input
                        id="tools"
                        placeholder={m.phTools}
                        value={formData.toolsCsv}
                        onChange={(event) => setFormData((prev) => ({ ...prev, toolsCsv: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="modes">{m.sessionModes}</Label>
                      <Input
                        id="modes"
                        placeholder={m.phModes}
                        value={formData.sessionModesCsv}
                        onChange={(event) => setFormData((prev) => ({ ...prev, sessionModesCsv: event.target.value }))}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <Separator />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={tabIndex === 0}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    {m.back}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={goNext}
                    disabled={tabIndex === TAB_ORDER.length - 1}
                  >
                    {m.next}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{stepLabel}</p>
              </div>

              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/mentors")}>
                  {m.viewMentors}
                </Button>
                <Button type="submit" className="gradient-cta text-white">
                  {m.submit}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {m.already}{" "}
                <Link to="/login?role=mentor" className="text-accent underline-offset-4 hover:underline">
                  {m.mentorLogin}
                </Link>
              </p>
            </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MentorRegisterPage;
