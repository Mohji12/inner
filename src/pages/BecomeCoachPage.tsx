import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  ClipboardList,
  CreditCard,
  Mail,
  Rocket,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { listMentors } from "@/api/mentors";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { BecomeCoachBenefits } from "@/components/become-coach/BecomeCoachBenefits";
import { BecomeCoachFitChecklist } from "@/components/become-coach/BecomeCoachFitChecklist";
import { BecomeCoachIntroHero } from "@/components/become-coach/BecomeCoachIntroHero";
import { cn } from "@/lib/utils";

const STEP_ICONS = [UserPlus, Mail, CreditCard, BadgeCheck, Wallet, Rocket] as const;

const BecomeCoachPage = () => {
  const { t } = useLanguage();
  const b = t.app.becomeCoach;
  const { data: mentors = [] } = useQuery({
    queryKey: ["mentors", "public", "become-coach-count", import.meta.env.PROD],
    queryFn: () => listMentors(import.meta.env.PROD),
  });
  const socialProof =
    mentors.length > 0 ? b.socialProofTemplate.replace("{count}", String(mentors.length)) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main>
        <BecomeCoachIntroHero
          label={b.introLabel}
          title={b.introTitle}
          introP1={b.introP1}
          introP2={b.introP2}
          ctaApply={b.ctaApply}
          ctaAgreement={b.ctaAgreement}
          ctaLogin={b.ctaLogin}
        />

        <BecomeCoachBenefits label={b.benefitsLabel} benefits={b.benefits} socialProof={socialProof} />

        <BecomeCoachFitChecklist label={b.fitLabel} items={b.fitItems} />

        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6">
            <div className="mb-12 max-w-2xl">
              <span className="text-sm font-medium uppercase tracking-widest text-accent">{b.stepsLabel}</span>
              <h2 className="mt-3 font-serif text-3xl font-semibold md:text-4xl">{b.stepsHeading}</h2>
            </div>

            <ol className="relative mx-auto max-w-3xl space-y-0">
              {b.steps.map((step, index) => {
                const Icon = STEP_ICONS[index] ?? UserPlus;
                const isLast = index === b.steps.length - 1;
                return (
                  <li key={step.title} className="relative flex gap-6 pb-12 last:pb-0">
                    {!isLast ? (
                      <span
                        aria-hidden
                        className="absolute left-6 top-14 h-[calc(100%-3.5rem)] w-px bg-border"
                      />
                    ) : null}
                    <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/10 text-accent">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Step {index + 1}
                      </p>
                      <h3 className="mt-1 font-serif text-xl font-semibold md:text-2xl">{step.title}</h3>
                      <p className="mt-2 text-muted-foreground">{step.desc}</p>
                      <ul className="mt-4 space-y-2">
                        {step.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2 text-sm leading-relaxed">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/30 py-16 md:py-20">
          <div className="container mx-auto grid gap-8 px-6 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <CardTitle className="font-serif text-2xl">{b.requirementsHeading}</CardTitle>
                <CardDescription>{b.requirementsLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {b.requirements.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <CreditCard className="h-5 w-5" />
                </div>
                <CardTitle className="font-serif text-2xl">{b.feesHeading}</CardTitle>
                <CardDescription>{b.feesLabel}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {b.fees.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-6">
            <div className="mx-auto max-w-3xl">
              <span className="text-sm font-medium uppercase tracking-widest text-accent">{b.guidelinesLabel}</span>
              <h2 className="mt-3 font-serif text-3xl font-semibold md:text-4xl">{b.guidelinesHeading}</h2>
              <p className="mt-3 text-muted-foreground">{b.guidelinesIntro}</p>
              <ul className="mt-8 space-y-3 rounded-xl border border-border/60 bg-card p-6 md:p-8">
                {b.guidelines.map((guideline) => (
                  <li
                    key={guideline}
                    className={cn("list-none text-sm font-medium leading-relaxed text-foreground md:text-base")}
                  >
                    {guideline}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-border/60 bg-primary py-16 text-primary-foreground md:py-20">
          <div className="container mx-auto px-6 text-center">
            <h2 className="font-serif text-3xl font-semibold md:text-4xl">{b.readyTitle}</h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">{b.readySub}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
                <Link to="/mentor/register">{b.ctaRegister}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/mentors">{t.app.mentorsPage.directory}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default BecomeCoachPage;
