import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { forgotPassword } from "@/api/auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { humanizeApiError } from "@/lib/humanizeApiError";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const f = t.app.forgotPassword;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "mentor">("user");
  const [isLoading, setIsLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFieldError(f.errEmailRequired);
      return;
    }
    setFieldError("");

    setIsLoading(true);
    try {
      await forgotPassword({ email: email.trim(), role });
      toast.success(f.toastSent);
      navigate("/reset-password", { state: { email: email.trim(), role } });
    } catch (error: unknown) {
      toast.error(humanizeApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-xl border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{f.title}</CardTitle>
            <CardDescription>{f.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>{f.roleLabel}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={role === "user" ? "default" : "outline"}
                    onClick={() => setRole("user")}
                    className="w-full"
                  >
                    {f.user}
                  </Button>
                  <Button
                    type="button"
                    variant={role === "mentor" ? "default" : "outline"}
                    onClick={() => setRole("mentor")}
                    className="w-full"
                  >
                    {f.mentor}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{f.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError) setFieldError("");
                  }}
                  required
                />
                {fieldError ? <p className="text-sm text-destructive">{fieldError}</p> : null}
              </div>
              <Button type="submit" className="w-full gradient-cta text-white" disabled={isLoading}>
                {isLoading ? f.submitting : f.submit}
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-accent hover:underline">
                  {f.backToLogin}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
