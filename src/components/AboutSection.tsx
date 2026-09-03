import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";

const aboutSectionImage = "/Gemini_Generated_Image_qnnrsrqnnrsrqnnr.png";

const AboutSection = () => {
  const ref = useScrollReveal();
  const { t } = useLanguage();

  return (
    <section id="about" className="py-24 md:py-32 bg-background">
      <div ref={ref} className="section-reveal container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="relative group">
            <div className="absolute -inset-4 gradient-spiritual rounded-2xl opacity-30 blur-2xl group-hover:opacity-50 transition-opacity duration-700" />
            <img
              src={aboutSectionImage}
              alt="Spiritual meditation practice"
              className="relative w-full h-auto rounded-2xl shadow-xl"
              loading="lazy"
            />
          </div>
          <div className="space-y-6">
            <span className="text-sm font-medium tracking-widest uppercase text-accent">{t.about.label}</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold leading-[1.15] tracking-tight text-balance">
              {t.about.heading}
            </h2>
            <div className="w-16 h-0.5 bg-accent/50 rounded-full" />
            <p className="text-muted-foreground leading-relaxed text-base md:text-lg">{t.about.p1}</p>
            <p className="text-muted-foreground leading-relaxed text-base md:text-lg">{t.about.p2}</p>
            <a href="#services" className="inline-block mt-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors border-b border-accent/30 hover:border-accent/60 pb-0.5">
              {t.about.link}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
