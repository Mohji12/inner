import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";
import { worldwideTestimonials } from "@/data/worldwideTestimonials";

const TestimonialsSection = () => {
  const ref = useScrollReveal();
  const { t } = useLanguage();

  const doubled = [...worldwideTestimonials, ...worldwideTestimonials];

  return (
    <section className="pt-14 pb-10 md:pt-20 md:pb-14 bg-background overflow-hidden">
      <div ref={ref} className="section-reveal">
        <div className="text-center mb-16 px-6">
          <span className="text-sm font-medium tracking-widest uppercase text-accent">{t.testimonials.label}</span>
          <h2 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-serif font-semibold tracking-tight text-balance">
            {t.testimonials.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground md:text-base">
            {t.testimonials.worldwideCaption}
          </p>
        </div>

        <div className="relative overflow-x-hidden" dir="ltr">
          <div className="flex w-max animate-slide-testimonial gap-6">
            {doubled.map((item, i) => (
              <div
                key={`${item.htmlLang}-${item.name}-${i}`}
                dir={item.htmlLang === "ar" ? "rtl" : "ltr"}
                className="glass-card flex w-80 flex-shrink-0 flex-col rounded-2xl p-8 transition-shadow duration-300 hover:shadow-xl"
              >
                <span className="mb-3 inline-flex w-fit rounded-full border border-border/70 bg-background/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {item.label}
                </span>
                <p lang={item.htmlLang} className="mb-4 flex-1 text-pretty text-sm italic leading-relaxed text-foreground">
                  &ldquo;{item.text}&rdquo;
                </p>
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
