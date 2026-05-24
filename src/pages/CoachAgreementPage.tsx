import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { COACH_AGREEMENT_TEXT, COACH_AGREEMENT_VERSION } from "@/lib/coachAgreement";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CoachAgreementPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto flex-1 px-6 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <p className="text-xs text-muted-foreground">Version: {COACH_AGREEMENT_VERSION}</p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap rounded-lg border border-border/60 bg-card p-6 text-sm leading-6">
            {COACH_AGREEMENT_TEXT}
          </pre>
          <p className="mt-6 text-sm text-muted-foreground">
            This page is shown for transparency. You must accept this agreement during coach registration.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

