import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { verifyUserEmailLink } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { humanizeApiError } from "@/lib/humanizeApiError";

const UserVerifyLinkPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUserSession } = useAuth();
  const { t, htmlLang } = useLanguage();
  const a = t.app.userRegister;
  const token = (searchParams.get("token") || "").trim();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [error, setError] = useState(token ? "" : a.verifyLinkMissing);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await verifyUserEmailLink(token);
        setUserSession(res.access_token);
        setStatus("success");
        const params = new URLSearchParams();
        if (res.user_id) params.set("userId", res.user_id);
        const query = params.toString();
        navigate(`/user/register/thank-you${query ? `?${query}` : ""}`, { replace: true });
      } catch (err: unknown) {
        setStatus("error");
        setError(humanizeApiError(err, a.verifyLinkFailed));
      }
    })();
  }, [token, navigate, setUserSession, a.verifyLinkFailed, a.verifyLinkMissing]);

  return (
    <div className="min-h-screen bg-background text-foreground" lang={htmlLang}>
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-lg border-border/60">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">{a.verifyTitle}</CardTitle>
            <CardDescription>
              {status === "loading"
                ? a.verifyLinkLoading
                : status === "success"
                  ? a.verifyLinkSuccess
                  : a.verifyLinkFailed}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "error" ? (
              <>
                {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <Link to="/login?role=user">{a.verifyLinkLogin}</Link>
                  </Button>
                  <Button asChild className="gradient-cta text-white">
                    <Link to="/user/register">{a.verifyLinkRegister}</Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{a.verifyLinkLoading}</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default UserVerifyLinkPage;
