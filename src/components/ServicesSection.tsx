import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";

/** Public folder JPEGs — order: Live Chat → Coaching → Energy Training → Personal Consultation */
const SERVICE_CARD_IMAGES = [
  encodeURI("/Create_a_bright,_inspiring,_and_202605102259.jpeg"),
  encodeURI("/Create_a_bright,_inspiring,_and_202605102301.jpeg"),
  encodeURI("/Create_a_bright,_inspiring,_and_202605102302.jpeg"),
  encodeURI("/Create_a_bright,_inspiring,_and_202605102307.jpeg"),
];

const ServicesSection = () => {
  const ref = useScrollReveal();
  const { t } = useLanguage();

  return (
    <section id="services" className="py-24 md:py-32 bg-cream">
      <div ref={ref} className="section-reveal container mx-auto px-6">
        <div className="mb-16 text-center">
          <span className="text-sm font-medium uppercase tracking-widest text-accent">{t.services.label}</span>
          <h2 className="mt-3 text-balance text-3xl font-serif font-semibold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            {t.services.heading}
          </h2>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {t.services.items.map((s, i) => (
            <article
              key={i}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/95 shadow-sm ring-1 ring-black/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={SERVICE_CARD_IMAGES[i]}
                  alt={s.title}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent opacity-60" />
              </div>
              <div className="flex flex-1 flex-col px-5 pb-6 pt-5 md:px-6 md:pb-7 md:pt-6">
                <h3 className="text-balance font-serif text-lg font-semibold leading-snug tracking-tight text-foreground md:text-xl">
                  {s.title}
                </h3>
                <p className="mt-3 flex-1 whitespace-pre-line text-pretty text-sm leading-relaxed text-card-foreground md:text-[0.9375rem]">
                  {s.desc}
                </p>
                <div className="mt-5 flex items-center border-t border-border/60 pt-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-card-foreground transition-opacity duration-300 group-hover:opacity-80">
                    {t.services.explore}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
