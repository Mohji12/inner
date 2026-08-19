import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import AppPageHeader from "@/components/AppPageHeader";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { languageLabels, type Language } from "@/i18n/translations";
import { registerUser, resendUserVerifyEmail, verifyUserEmail } from "@/api/auth";
import { patchUserMe } from "@/api/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import PhoneWithDialCode from "@/components/PhoneWithDialCode";
import OtpEmailHint from "@/components/OtpEmailHint";
import { composeE164Phone, DEFAULT_DIAL_ISO, dialCodeForIso } from "@/lib/countryDialCodes";

const SUPPORT_EMAIL = "info@mijnlevenspad.com";

const LANGUAGE_OPTIONS = Object.keys(languageLabels) as Language[];

const UserRegisterPage = () => {
  const navigate = useNavigate();
  const { loginUserSession } = useAuth();
  const { t, language, htmlLang } = useLanguage();
  const a = t.app.userRegister;
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"form" | "verify">("form");
  const [otp, setOtp] = useState("");
  const [verifyCtx, setVerifyCtx] = useState<{ email: string; password: string; userId: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    phoneDialIso: DEFAULT_DIAL_ISO,
    password: "",
    city: "",
    goals: "",
    preferredLanguage: language,
    gender: "",
    dateOfBirth: "",
  });

  useEffect(() => {
    setFormData((prev) => ({ ...prev, preferredLanguage: language }));
  }, [language]);

  const finishRegistration = (userId: string) => {
    const params = new URLSearchParams();
    if (userId) {
      params.set("userId", userId);
    }
    const query = params.toString();
    navigate(`/user/register/thank-you${query ? `?${query}` : ""}`);
  };

  const completeUserOnboarding = async (email: string, password: string, userId: string) => {
    await loginUserSession({ email, password });
    await patchUserMe({
      location: formData.city.trim() || null,
      goals: formData.goals.trim() || null,
      gender: formData.gender.trim() || null,
      date_of_birth: formData.dateOfBirth.trim() || null,
    });
    finishRegistration(userId);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.password || formData.password.length < 8) {
      setError(a.errFields);
      return;
    }
    const emailTrimmed = formData.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError(a.errEmailInvalid);
      return;
    }
    const phoneE164 = composeE164Phone(dialCodeForIso(formData.phoneDialIso), formData.phone);
    if (!phoneE164 || phoneE164.replace(/\D/g, "").length < 8) {
      setError(a.errFields);
      return;
    }

    try {
      const email = formData.email.trim();
      const reg = await registerUser({
        full_name: formData.name.trim(),
        email,
        phone_number: phoneE164,
        password: formData.password,
        preferred_language: formData.preferredLanguage.trim() || language,
      });
      setVerifyCtx({ email, password: formData.password, userId: reg.id });
      setOtp("");
      setPhase("verify");
      toast.message(a.verifyDescription.replace("{email}", email));
      if (reg.dev_verification_code) {
        toast.message(a.devCodeToast.replace("{code}", reg.dev_verification_code), { duration: 20000 });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : a.errFailed;
      setError(msg);
      toast.error(msg);
    }
  };

  const onVerifyOtp = async () => {
    if (!verifyCtx || otp.replace(/\D/g, "").length !== 6) {
      setError(a.errVerify);
      return;
    }
    setError("");
    try {
      await verifyUserEmail({ email: verifyCtx.email, code: otp.replace(/\D/g, "") });
      await completeUserOnboarding(verifyCtx.email, verifyCtx.password, verifyCtx.userId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : a.errVerify;
      setError(msg);
      toast.error(msg);
    }
  };

  const onResendOtp = async () => {
    if (!verifyCtx) return;
    try {
      await resendUserVerifyEmail(verifyCtx.email);
      toast.message(a.resendToast);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : a.errFailed;
      toast.error(msg);
    }
  };

  const helpSteps = [a.helpStep1, a.helpStep2, a.helpStep3, a.helpStep4, a.helpStep5];
  const supportMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(a.supportMailSubject)}`;

  return (
    <div className="min-h-screen bg-background text-foreground" lang={htmlLang}>
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-6xl border-border/60">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="font-serif text-3xl">{a.title}</CardTitle>
              <CardDescription>{a.description}</CardDescription>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/login?role=user">{a.logIn}</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-8 lg:grid-cols-5 lg:items-start">
            <div className="min-w-0 lg:col-span-3">
            {phase === "verify" ? (
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h3 className="font-serif text-xl">{a.verifyTitle}</h3>
                  <p className="text-sm text-muted-foreground">
                    {a.verifyDescription.replace("{email}", verifyCtx?.email ?? formData.email)}
                  </p>
                </div>
                <OtpEmailHint title={a.otpHintTitle} body={a.otpHintBody} />
                <div className="space-y-2">
                  <Label htmlFor="otp">{a.otpLabel}</Label>
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
                    {a.back}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void onResendOtp()}>
                    {a.resendCode}
                  </Button>
                  <Button type="button" className="gradient-cta text-white" onClick={() => void onVerifyOtp()}>
                    {a.verifySubmit}
                  </Button>
                </div>
              </div>
            ) : (
              <form lang={htmlLang} onSubmit={(e) => void onSubmit(e)} className="grid grid-cols-1 gap-5">
                <OtpEmailHint title={a.otpHintTitle} body={a.otpHintBody} />
                <div className="space-y-2">
                  <Label htmlFor="name">{a.fullName}</Label>
                  <Input
                    id="name"
                    lang={htmlLang}
                    spellCheck
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{a.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{a.phone}</Label>
                  <PhoneWithDialCode
                    id="phone"
                    dialIso={formData.phoneDialIso}
                    localNumber={formData.phone}
                    onDialIsoChange={(phoneDialIso) => setFormData((prev) => ({ ...prev, phoneDialIso }))}
                    onLocalNumberChange={(phone) => setFormData((prev) => ({ ...prev, phone }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{a.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
                  />
                  <PasswordStrengthMeter password={formData.password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{a.city}</Label>
                  <Input
                    id="city"
                    lang={htmlLang}
                    spellCheck
                    placeholder={a.cityPlaceholder}
                    value={formData.city}
                    onChange={(event) => setFormData((prev) => ({ ...prev, city: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">{a.gender}</Label>
                  <Input
                    id="gender"
                    lang={htmlLang}
                    spellCheck
                    placeholder={a.genderPlaceholder}
                    value={formData.gender}
                    onChange={(event) => setFormData((prev) => ({ ...prev, gender: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">{a.dob}</Label>
                  <Input
                    id="dob"
                    type="date"
                    lang={htmlLang}
                    value={formData.dateOfBirth}
                    onChange={(event) => setFormData((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lang">{a.preferredLang}</Label>
                  <select
                    id="lang"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.preferredLanguage}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, preferredLanguage: event.target.value }))
                    }
                  >
                    {LANGUAGE_OPTIONS.map((code) => (
                      <option key={code} value={code}>
                        {languageLabels[code]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goals">{a.goals}</Label>
                  <Textarea
                    id="goals"
                    rows={5}
                    lang={htmlLang}
                    spellCheck
                    placeholder={a.goalsPlaceholder}
                    value={formData.goals}
                    onChange={(event) => setFormData((prev) => ({ ...prev, goals: event.target.value }))}
                  />
                </div>
                {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button asChild type="button" variant="outline">
                    <Link to="/login?role=user">{a.logIn}</Link>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/")}>
                    {a.back}
                  </Button>
                  <Button type="submit" className="gradient-cta text-white">
                    {a.submit}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {a.haveAccount}{" "}
                  <Link to="/login?role=user" className="text-accent underline-offset-4 hover:underline">
                    {a.logIn}
                  </Link>
                </p>
              </form>
            )}
            </div>
            <aside className="space-y-6 rounded-xl border border-border/50 bg-muted/20 p-5 lg:col-span-2 lg:sticky lg:top-24">
              <div>
                <h3 className="font-serif text-xl">{a.helpTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.helpIntro}</p>
                <ol className="mt-4 space-y-3">
                  {helpSteps.map((step, index) => (
                    <li key={index} className="flex gap-3 text-sm leading-relaxed">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="border-t border-border/50 pt-5">
                <h3 className="font-serif text-xl">{a.supportTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.supportBody}</p>
                <a
                  href={supportMailto}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Mail className="h-4 w-4" />
                  {a.supportEmailCta}
                </a>
                <a
                  href={supportMailto}
                  className="mt-2 block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </aside>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default UserRegisterPage;
