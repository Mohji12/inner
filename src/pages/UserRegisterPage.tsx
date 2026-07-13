import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
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

const UserRegisterPage = () => {
  const navigate = useNavigate();
  const { loginUserSession } = useAuth();
  const { t } = useLanguage();
  const a = t.app.userRegister;
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"form" | "verify">("form");
  const [otp, setOtp] = useState("");
  const [verifyCtx, setVerifyCtx] = useState<{ email: string; password: string; userId: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    city: "",
    goals: "",
    preferredLanguage: "en",
    gender: "",
    dateOfBirth: "",
  });

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

    try {
      const email = formData.email.trim();
      const reg = await registerUser({
        full_name: formData.name.trim(),
        email,
        phone_number: formData.phone.trim(),
        password: formData.password,
        preferred_language: formData.preferredLanguage.trim() || "en",
      });
      if (reg.dev_verification_code) {
        await verifyUserEmail({ email, code: reg.dev_verification_code });
        await completeUserOnboarding(email, formData.password, reg.id);
        return;
      }
      setVerifyCtx({ email, password: formData.password, userId: reg.id });
      setOtp("");
      setPhase("verify");
      toast.message(a.verifyDescription);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-3xl border-border/60">
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{a.title}</CardTitle>
            <CardDescription>{a.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {phase === "verify" ? (
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h3 className="font-serif text-xl">{a.verifyTitle}</h3>
                  <p className="text-sm text-muted-foreground">{a.verifyDescription}</p>
                </div>
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
            <form onSubmit={(e) => void onSubmit(e)} className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <Label htmlFor="name">{a.fullName}</Label>
                <Input
                  id="name"
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
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))}
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
                  value={formData.city}
                  onChange={(event) => setFormData((prev) => ({ ...prev, city: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">{a.gender}</Label>
                <Input
                  id="gender"
                  value={formData.gender}
                  onChange={(event) => setFormData((prev) => ({ ...prev, gender: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">{a.dob}</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(event) => setFormData((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lang">{a.preferredLang}</Label>
                <Input
                  id="lang"
                  value={formData.preferredLanguage}
                  onChange={(event) => setFormData((prev) => ({ ...prev, preferredLanguage: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goals">{a.goals}</Label>
                <Textarea
                  id="goals"
                  rows={5}
                  value={formData.goals}
                  onChange={(event) => setFormData((prev) => ({ ...prev, goals: event.target.value }))}
                />
              </div>
              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
              <div className="flex justify-end gap-3">
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default UserRegisterPage;
