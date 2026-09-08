import { useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

const heroPromoCopy: Record<Language, { announcement: string; label: string; copied: string }> = {
  en: {
    announcement: "New here? Get a 5-minute session for FREE! Use promo code:",
    label: "Copy code",
    copied: "Promo code WELCOME5 copied!",
  },
  nl: {
    announcement: "Nieuw hier? Krijg een sessie van 5 minuten GRATIS! Gebruik promocode:",
    label: "Code kopiëren",
    copied: "Promocode WELCOME5 gekopieerd!",
  },
  fr: {
    announcement: "Nouveau ici ? Obtenez une séance de 5 minutes GRATUITE ! Utilisez le code promo :",
    label: "Copier le code",
    copied: "Code promo WELCOME5 copié !",
  },
  ar: {
    announcement: "جديد هنا؟ احصل على جلسة مدتها 5 دقائق مجاناً! استخدم الرمز الترويجي:",
    label: "نسخ الرمز",
    copied: "تم نسخ الرمز الترويجي WELCOME5!",
  },
  zh: {
    announcement: "新用户专享？免费获得 5 分钟初次体验咨询！使用优惠码：",
    label: "复制代码",
    copied: "优惠码 WELCOME5 已复制！",
  },
  ru: {
    announcement: "Впервые у нас? Получите 5-минутную сессию БЕСПЛАТНО! Промокод:",
    label: "Скопировать код",
    copied: "Промокод WELCOME5 скопирован!",
  },
  es: {
    announcement: "¿Nuevo por aquí? ¡Obtén una sesión de 5 minutos GRATIS! Usa el código promocional:",
    label: "Copiar código",
    copied: "¡Código promocional WELCOME5 copiado!",
  },
  it: {
    announcement: "Nuovo utente? Ottieni una sessione di 5 minuti GRATIS! Usa il codice promozionale:",
    label: "Copia codice",
    copied: "Codice promozionale WELCOME5 copiato!",
  },
  de: {
    announcement: "Neu hier? Erhalte eine 5-minütige Sitzung KOSTENLOS! Nutze den Promo-Code:",
    label: "Code kopieren",
    copied: "Promo-Code WELCOME5 kopiert!",
  },
  ro: {
    announcement: "Nou aici? Primești o sesiune de 5 minute GRATUIT! Folosește codul promoțional:",
    label: "Copiază codul",
    copied: "Codul promoțional WELCOME5 a fost copiat!",
  },
};

const HeroSection = () => {
  const { t, language } = useLanguage();
  const promo = heroPromoCopy[language] ?? heroPromoCopy.en;
  const [copied, setCopied] = useState(false);

  const handleCopyPromo = async () => {
    try {
      await navigator.clipboard.writeText("WELCOME5");
      setCopied(true);
      toast.success(promo.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.success(promo.copied);
    }
  };

  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] items-start justify-center overflow-hidden bg-transparent pt-24 sm:pt-28 md:pt-32 lg:pt-36"
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

        {/* Promo code announcement banner */}
        <div className="mt-6 sm:mt-8 flex w-full max-w-lg flex-col items-center gap-2.5 rounded-2xl border border-white/25 bg-black/25 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-md transition-all hover:bg-black/30 sm:max-w-xl sm:flex-row sm:flex-wrap sm:justify-center sm:rounded-full sm:px-5 sm:py-2.5 md:text-base">
          <span className="inline-flex min-w-0 items-center justify-center gap-2 text-pretty text-center sm:text-left">
            <Gift className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="font-light leading-snug">{promo.announcement}</span>
          </span>
          <button
            type="button"
            onClick={handleCopyPromo}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#E2E5D3] px-3 py-1 font-mono text-xs font-bold tracking-wider text-[#2C3E2D] shadow-sm transition-all hover:bg-[#d6d8c6] active:scale-95 cursor-pointer"
            title={promo.label}
          >
            <span>WELCOME5</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-700" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[#2C3E2D]/70" />
            )}
          </button>
        </div>

        <div className="mt-8 flex w-full max-w-xl flex-col items-stretch gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4 md:mt-12 lg:mt-14">
          <a
            href="#services"
            className="w-full rounded-xl px-8 py-3.5 text-center text-sm font-medium tracking-wide text-white shadow-lg gradient-cta transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] sm:w-auto"
          >
            {t.hero.cta1}
          </a>
          <a
            href="#pricing"
            className="w-full rounded-xl border border-border/80 bg-background/85 px-8 py-3.5 text-center text-sm font-medium tracking-wide text-foreground shadow-sm backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:bg-background active:scale-[0.98] sm:w-auto"
          >
            {t.hero.cta2}
          </a>
          <Link
            to="/mentors"
            className="w-full rounded-xl bg-primary px-8 py-3.5 text-center text-sm font-medium tracking-wide text-primary-foreground shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] sm:w-auto"
          >
            {t.hero.cta3}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;