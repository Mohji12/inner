import { useLanguage } from "@/i18n/LanguageContext";

const WhyChooseIntroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="bg-white py-12 md:py-14 lg:py-16" aria-labelledby="why-choose-intro-title">
      <div className="container mx-auto max-w-4xl px-6 text-start">
        <p className="font-serif text-base text-zinc-500 md:text-lg">{t.whyChoose.heading}</p>
        <h2
          id="why-choose-intro-title"
          className="mt-2 font-sans text-2xl font-bold tracking-tight text-zinc-800 md:text-3xl lg:text-4xl"
        >
          {t.whyChoose.introTagline}
        </h2>
      </div>
    </section>
  );
};

export default WhyChooseIntroSection;
