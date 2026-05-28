import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthSuccessOverlay } from "@/components/ui/SuccessBurst";
import { toast } from "sonner";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
import { loginUser2FA, loginMentor2FA } from "@/api/auth";
import { ShieldAlert, ArrowLeft } from "lucide-react";

type Role = "user" | "mentor" | "admin";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
const AUTH_SUCCESS_DELAY_MS = 1200;

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginUserSession, loginMentorSession, loginAdminSession, setUserSession, setMentorSession } = useAuth();
  const { t } = useLanguage();
  const a = t.app.login;
  const [role, setRole] = useState<Role>("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  // 2FA state
  const [is2FARequired, setIs2FARequired] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [authSuccess, setAuthSuccess] = useState<{ to: string; message: string } | null>(null);

  useEffect(() => {
    const r = searchParams.get("role");
    if (r === "mentor" || r === "user" || r === "admin") setRole(r);
  }, [searchParams]);

  useEffect(() => {
    if (!authSuccess) return;
    const timer = window.setTimeout(() => {
      navigate(authSuccess.to, { replace: true });
    }, AUTH_SUCCESS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [authSuccess, navigate]);

  const finishLogin = (to: string, message: string) => {
    setAuthSuccess({ to, message });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError(a.errEmailPassword);
      return;
    }

    try {
      if (role === "user") {
        const res = await loginUserSession({ email: email.trim(), password });
        if (res.two_factor_required) {
          setIs2FARequired(true);
          setTempToken(res.temp_token!);
          return;
        }
        finishLogin("/user/appointments", "Welcome back!");
        return;
      }
      if (role === "mentor") {
        const res = await loginMentorSession({ email: email.trim(), password });
        if (res.two_factor_required) {
          setIs2FARequired(true);
          setTempToken(res.temp_token!);
          return;
        }
        finishLogin("/mentor/appointments", "Welcome back, Coach!");
        return;
      }
      await loginAdminSession({ email: email.trim(), password });
      finishLogin("/admin", "Welcome back!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : a.errFailed;
      setError(msg);
      toast.error(msg);
    }
  };

  const on2FASubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (twoFactorCode.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }

    try {
      const body = {
        email: email.trim(),
        code: twoFactorCode,
        temp_token: tempToken,
        role: role as 'user' | 'mentor'
      };

      const res = role === 'user' ? await loginUser2FA(body) : await loginMentor2FA(body);
      
      if (role === 'user') setUserSession(res.access_token);
      else setMentorSession(res.access_token);

      finishLogin(
        role === 'user' ? "/user/appointments" : "/mentor/appointments",
        role === 'user' ? "Welcome back!" : "Welcome back, Coach!",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "2FA verification failed";
      toast.error(msg);
    }
  };

  const render2FAForm = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <ShieldAlert className="w-12 h-12 text-primary animate-pulse" />
        <h3 className="text-xl font-semibold">Two-Factor Authentication</h3>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app to complete sign-in.
        </p>
      </div>
      <form onSubmit={(e) => void on2FASubmit(e)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="2fa-code">Authentication Code</Label>
          <Input
            id="2fa-code"
            type="text"
            placeholder="000000"
            maxLength={6}
            value={twoFactorCode}
            onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
            className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full gradient-cta text-white h-12 text-lg">
          Verify & Sign In
        </Button>
      </form>
      <button 
        onClick={() => setIs2FARequired(false)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mx-auto"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to password login
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {authSuccess ? <AuthSuccessOverlay message={authSuccess.message} description="Taking you to your dashboard…" /> : null}
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-xl border-border/60 shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30 pb-8">
            <CardTitle className="font-serif text-3xl">{is2FARequired ? "Security Verification" : a.title}</CardTitle>
            <CardDescription>{is2FARequired ? "Additional security required" : a.description}</CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            {is2FARequired ? render2FAForm() : (
              <div className="space-y-8">
                <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
                  <div>
                    <p className="mb-3 text-sm font-medium">{a.loginAs}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        className={`rounded-md border px-2 py-3 text-sm transition-all ${role === "user" ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary" : "border-border hover:bg-muted"}`}
                        onClick={() => setRole("user")}
                      >
                        {a.user}
                      </button>
                      <button
                        type="button"
                        className={`rounded-md border px-2 py-3 text-sm transition-all ${role === "mentor" ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary" : "border-border hover:bg-muted"}`}
                        onClick={() => setRole("mentor")}
                      >
                        {a.mentor}
                      </button>
                      <button
                        type="button"
                        className={`rounded-md border px-2 py-3 text-sm transition-all ${role === "admin" ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary" : "border-border hover:bg-muted"}`}
                        onClick={() => setRole("admin")}
                      >
                        {a.admin}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{a.email}</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">{a.password}</Label>
                      <Link to="/forgot-password"
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11"
                    />
                  </div>
                  
                  {error ? (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm font-medium text-destructive">
                      {error}
                    </div>
                  ) : null}
                  
                  <Button type="submit" className="w-full gradient-cta text-white h-11 text-base">
                    {a.submit}
                  </Button>
                </form>

                {role !== "admin" && GOOGLE_CLIENT_ID && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                      </div>
                    </div>

                    <GoogleSignIn 
                      role={role as 'user' | 'mentor'} 
                      on2FARequired={(token) => {
                        setIs2FARequired(true);
                        setTempToken(token);
                      }}
                      onAuthenticated={(authRole) => {
                        finishLogin(
                          authRole === "user" ? "/user/appointments" : "/mentor/appointments",
                          authRole === "user" ? "Welcome back!" : "Welcome back, Coach!",
                        );
                      }}
                    />
                  </>
                )}

                {role !== "admin" ? (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    {a.newHere}{" "}
                    <Link to="/user/register" className="text-primary font-medium hover:underline">
                      {a.registerUser}
                    </Link>{" "}
                    {a.orWord}{" "}
                    <Link to="/mentor/register" className="text-primary font-medium hover:underline">
                      {a.registerMentor}
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LoginPage;
