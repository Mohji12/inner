import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Legacy route: booking now happens on the coach profile (slot picker + dialog). */
const BookingPage = () => {
  const { mentorId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (mentorId) {
      navigate(`/mentors/${mentorId}`, { replace: true });
    }
  }, [mentorId, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Redirecting…</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate(mentorId ? `/mentors/${mentorId}` : "/mentors")}>
              Continue
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BookingPage;
