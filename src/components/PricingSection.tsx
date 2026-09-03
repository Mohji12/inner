import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";
import { Check } from "lucide-react";

const durations = ["10 min", "20 min", "30 min"];
const prices = ["€10", "€20", "€30"];
const featured = [false, true, false];

const PricingSection = () => {
  const ref = useScrollReveal();
  const { t } = useLanguage();

  return (
    <section id="pricing" className="py-24 md:py-32 bg-cream">
      <div ref={ref} className="section-reveal container mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-sm font-medium tracking-widest uppercase text-accent">{t.pricing.label}</span>
          <h2 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-serif font-semibold tracking-tight text-balance">
            {t.pricing.heading}
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-start">
          {t.pricing.plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-2xl p-8 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
                featured[i] ? "glass-card glow-gold shadow-xl scale-[1.03]" : "glass-card hover:shadow-lg"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              {featured[i] && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-medium uppercase tracking-widest gradient-cta text-white rounded-full">
                  {t.pricing.popular}
                </span>
              )}
              <div className="text-center mb-6">
                <p className="text-sm text-muted-foreground font-medium mb-1">{durations[i]}</p>
                <p className="text-4xl font-serif font-bold tracking-tight">{prices[i]}</p>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-accent flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-3 rounded-xl text-sm font-medium tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] ${
                  featured[i] ? "gradient-cta text-white shadow-md hover:shadow-lg" : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {t.pricing.bookNow}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
