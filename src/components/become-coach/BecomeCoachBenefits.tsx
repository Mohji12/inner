import { Clock, ShieldCheck, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Benefit = {
  title: string;
  desc: string;
};

type Props = {
  label: string;
  benefits: readonly Benefit[];
  socialProof?: string | null;
};

const BENEFIT_ICONS = [Users, Clock, Wallet, ShieldCheck] as const;

export function BecomeCoachBenefits({ label, benefits, socialProof }: Props) {
  return (
    <section className="bg-cream py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="mb-12 text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">{label}</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, index) => {
            const Icon = BENEFIT_ICONS[index] ?? ShieldCheck;
            return (
              <Card key={benefit.title} className="border-border/60 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <CardTitle className="font-serif text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{benefit.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {socialProof ? <p className="mt-8 text-center text-sm text-muted-foreground">{socialProof}</p> : null}
      </div>
    </section>
  );
}
