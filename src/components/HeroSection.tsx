import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-start justify-center overflow-hidden bg-transparent pt-28 sm:pt-32 md:pt-36 lg:pt-40"
    >
      <div className="pointer-events-none absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-gold/20 blur-3xl animate-float" />
      <div
        className="pointer-events-none absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-lavender/25 blur-3xl animate-float"
        style={{ animationDelay: "3s" }}
      />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
        <div className="flex w-full flex-col items-center gap-1 sm:gap-1.5">
          <h1 className="font-display text-3xl font-semibold leading-none text-heading sm:text-4xl md:text-5xl lg:text-6xl">
            {t.hero.heading}
          </h1>
          <p className="max-w-2xl text-pretty font-display text-base font-medium leading-snug text-[#8A7A63] sm:text-lg md:text-xl">
            {t.hero.subtext}
          </p>
        </div>
        <div className="mt-36 flex w-full max-w-xl flex-col flex-wrap justify-center gap-4 sm:mt-44 sm:flex-row sm:justify-center md:mt-52 lg:mt-60 xl:mt-64">
          <a
            href="#services"
            className="px-8 py-3.5 rounded-xl gradient-cta text-white font-medium text-sm tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            {t.hero.cta1}
          </a>
          <a
            href="#pricing"
            className="px-8 py-3.5 rounded-xl bg-background/85 backdrop-blur-md border border-border/80 text-foreground font-medium text-sm tracking-wide shadow-sm hover:bg-background hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            {t.hero.cta2}
          </a>
          <Link
            to="/mentors"
            className="px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm tracking-wide shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 text-center"
          >
            {t.hero.cta3}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection