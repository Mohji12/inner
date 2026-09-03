import { CheckCircle2 } from "lucide-react";

type Props = {
  label: string;
  items: readonly string[];
};

export function BecomeCoachFitChecklist({ label, items }: Props) {
  return (
    <section className="border-y border-border/60 bg-background py-16 md:py-20">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-serif text-3xl font-semibold md:text-4xl">{label}</h2>
          <ul className="mt-6 space-y-4">
            {items.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed md:text-base">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
