import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuccessBurst } from "@/components/ui/SuccessBurst";
import { useLanguage } from "@/i18n/LanguageContext";
import { initMetaPixel, trackCompleteRegistration } from "@/lib/metaPixel";

const REDIRECT_SECONDS = 5;

const UserRegisterThankYouPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { userAccessToken } = useAuth();
  const a = t.app.userRegister;
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message")?.trim();
  const userId = searchParams.get("userId")?.trim() ?? "";
  const trackedRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const sessionRef = useRef(userAccessToken);
  sessionRef.current = userAccessToken;

  useEffect(() => {
    if (trackedRef.current || !userId) {
      return;
    }
    trackedRef.current = true;
    initMetaPixel();
    trackCompleteRegistration({
      eventId: `user-verify-${userId}`,
      contentName: "user_registration",
      registrationRole: "user",
    });
  }, [userId]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sessionRef.current) {
        navigate("/user/dashboard", { replace: true });
      } else {
        navigate("/login?role=user", { replace: true });
      }
    }, REDIRECT_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-2xl border-border/60">
          <CardHeader className="items-center text-center">
            <SuccessBurst size="lg" label={a.toastWelcome} description={a.thankYouReady} className="mb-2" />
            <p className="text-sm uppercase tracking-widest text-accent">{a.thankYouLabel}</p>
            <CardTitle className="font-serif text-3xl">{a.thankYouTitle}</CardTitle>
            <CardDescription>{message || a.thankYouDescription}</CardDescription>
            <p className="pt-2 text-sm text-muted-foreground">
              {a.thankYouRedirect.replace("{seconds}", String(secondsLeft))}
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-3">
            <Button asChild className="gradient-cta text-white">
              <Link to="/user/dashboard">{a.thankYouGoDashboard}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/login?role=user">{a.thankYouLogin}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default UserRegisterThankYouPage;
