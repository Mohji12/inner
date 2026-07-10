import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuccessBurst } from "@/components/ui/SuccessBurst";
import { initMetaPixel, trackCompleteRegistration } from "@/lib/metaPixel";
import { sendMentorMetaCompleteRegistration } from "@/api/auth";

const MentorRegisterThankYouPage = () => {
  const [searchParams] = useSearchParams();
  const message = searchParams.get("message")?.trim();
  const mentorId = searchParams.get("mentorId")?.trim() ?? "";
  const trackedRef = useRef(false);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-2xl border-border/60">
          <CardHeader className="items-center text-center">
            <SuccessBurst
              size="lg"
              label="Registration complete"
              description="Your coach account setup is done"
              className="mb-2"
            />
            <p className="text-sm uppercase tracking-widest text-accent">Coach registration</p>
            <CardTitle className="font-serif text-3xl">Thank you for registering</CardTitle>
            <CardDescription>
              {message || "Your registration was completed successfully. You can now sign in to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-center gap-3">
            <Button asChild className="gradient-cta text-white">
              <Link to="/login?role=mentor">Go to mentor login</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/become-a-coach">Back to Become a Coach</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MentorRegisterThankYouPage;
