import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuccessBurst } from "@/components/ui/SuccessBurst";
import { useLanguage } from "@/i18n/LanguageContext";
import { initMetaPixel, trackCompleteRegistration } from "@/lib/metaPixel";
import { sendMentorMetaCompleteRegistration } from "@/api/auth";

const REDIRECT_SECONDS = 5;

const MentorRegisterThankYouPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { mentorAccessToken } = useAuth();
  const m = t.app.mentorRegister;
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message")?.trim();
  const mentorId = searchParams.get("mentorId")?.trim() ?? "";
  const trackedRef = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const sessionRef = useRef(mentorAccessToken);
  sessionRef.current = mentorAccessToken;

  useEffect(() => {
    if (trackedRef.current || !mentorId) {
      return;
    }
    trackedRef.current = true;
    initMetaPixel();
    trackCompleteRegistration({
      eventId: `mentor-verify-${mentorId}`,
      contentName: "coach_registration",
      registrationRole: "mentor",
    });
    void sendMentorMetaCompleteRegistration(mentorId).catch(() => {
      // Pixel still fires if CAPI call fails; server also sends on email verify.
    });
  }, [mentorId]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sessionRef.current) {
        navigate("/mentor/dashboard", { replace: true });
      } else {
        navigate("/login?role=mentor", { replace: true });
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
            <SuccessBurst size="lg" label={m.thankYouComplete} description={m.thankYouReady} className="mb-2" />
            <p className="text-sm uppercase tracking-widest text-accent">{m.thankYouLabel}</p>
            <CardTitle className="font-serif text-3xl">{m.thankYouTitle}</CardTitle>
            <CardDescription>{message || m.thankYouDescription}</CardDescription>
            <p className="pt-2 text-sm text-muted-foreground">
              {m.thankYouRedirect.replace("{seconds}", String(secondsLeft))}
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-3">
            <Button asChild className="gradient-cta text-white">
              <Link to="/mentor/dashboard">{m.thankYouGoDashboard}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/login?role=mentor">{m.thankYouLogin}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MentorRegisterThankYouPage;
