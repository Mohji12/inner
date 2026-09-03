import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { sendUserMetaLead } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuccessBurst } from "@/components/ui/SuccessBurst";
import { useLanguage } from "@/i18n/LanguageContext";
import { initMetaPixel, trackCompleteRegistration, trackLead } from "@/lib/metaPixel";

const UserRegisterThankYouPage = () => {
  const { t } = useLanguage();
  const a = t.app.userRegister;
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message")?.trim();
  const userId = searchParams.get("userId")?.trim() ?? "";
  const trackedRef = useRef(false);

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
    trackLead({
      eventId: `user-lead-${userId}`,
      contentName: "user_registration",
    });
    void sendUserMetaLead(userId).catch(() => {
      // Pixel still fires if CAPI call fails.
    });
  }, [userId]);

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
