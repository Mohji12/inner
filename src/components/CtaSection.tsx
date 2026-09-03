import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";

const CtaSection = () => {
  const ref = useScrollReveal();
  const { t } = useLanguage();

  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 gradient-cta" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl animate-glow-pulse" />

      <div ref={ref} className="section-reveal relative z-10 container mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold text-white leading-[1.15] tracking-tight text-balance mb-6">
          {t.cta.heading}
        </h2>
        <p className="mx-auto mb-10 max-w-lg text-lg font-semibold leading-relaxed text-white/90">
          {t.cta.subtext}
        </p>
        <a href="#pricing" className="inline-block px-10 py-4 rounded-xl bg-white text-primary font-medium text-sm tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.97] transition-all duration-300">
          {t.cta.button}
        </a>
      </div>
    </section>
  );
};

export default CtaSection;
