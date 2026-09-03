import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { forgotPassword, resetPassword } from "@/api/auth";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { useLanguage } from "@/i18n/LanguageContext";
import { humanizeApiError } from "@/lib/humanizeApiError";

type ResetLocationState = {
  email?: string;
  role?: "user" | "mentor";
};

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const r = t.app.resetPassword;
  const state = (location.state as ResetLocationState | null) ?? {};

  const email = state.email ?? searchParams.get("email") ?? "";
  const role = state.role ?? (searchParams.get("role") as "user" | "mentor" | null) ?? "user";

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate("/forgot-password", { replace: true });
    }
  }, [email, navigate]);

  const onResendCode = async () => {
    if (!email) return;
    setIsResending(true);
    try {
      await forgotPassword({ email, role });
      toast.success(r.toastResent);
    } catch (error: unknown) {
      toast.error(humanizeApiError(error));
    } finally {
      setIsResending(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      toast.error(r.errCode);
      return;
    }
    if (password.length < 8) {
      toast.error(r.errPasswordMin);
      return;
    }
    if (password !== confirmPassword) {
      toast.error(r.errMatch);
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword({
        email,
        role,
        code,
        new_password: password,
      });
      setIsSuccess(true);
      toast.success(r.toastOk);
      setTimeout(() => navigate("/login"), 3000);
    } catch (error: unknown) {
      toast.error(humanizeApiError(error, r.toastFailed));
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-xl border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{r.title}</CardTitle>
            <CardDescription>{r.description.replace("{email}", email)}</CardDescription>
          </CardHeader>
          <CardContent>
            {!isSuccess ? (
              <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="otp">{r.codeLabel}</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="password">{r.newPassword}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <PasswordStrengthMeter password={password} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{r.confirmPassword}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full gradient-cta text-white" disabled={isLoading}>
                  {isLoading ? r.submitting : r.submit}
                </Button>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link to="/forgot-password" className="text-accent hover:underline">
                    {r.differentEmail}
                  </Link>
                  <Button type="button" variant="ghost" size="sm" disabled={isResending} onClick={() => void onResendCode()}>
                    {isResending ? r.resending : r.resend}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 py-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-lg font-medium">{r.successTitle}</p>
                <p className="text-muted-foreground">{r.successDescription}</p>
                <Link to="/login">
                  <Button className="mt-4">{r.goToLogin}</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
