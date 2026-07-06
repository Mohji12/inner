import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  title: string;
  introP1: string;
  introP2: string;
  ctaApply: string;
  ctaAgreement: string;
  ctaLogin: string;
};

export function BecomeCoachIntroHero({
  label,
  title,
  introP1,
  introP2,
  ctaApply,
  ctaAgreement,
  ctaLogin,
}: Props) {
  return (
    <section className="border-b border-border/60 bg-gradient-to-b from-accent/10 via-background to-background py-16 md:py-24">
      <div className="container mx-auto max-w-3xl px-6">
        <span className="text-sm font-medium uppercase tracking-widest text-accent">{label}</span>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">{title}</h1>
        <p className="mt-6 text-lg text-muted-foreground">{introP1}</p>
        <p className="mt-4 text-lg text-muted-foreground">{introP2}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild className="gradient-cta text-white">
            <a href="#apply">
              {ctaApply}
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link to="/coach-agreement">{ctaAgreement}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/login?role=mentor">{ctaLogin}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
