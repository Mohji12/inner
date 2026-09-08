import { useState } from "react";
import { Clock, Gift, Copy, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

/** Card header images (5 → 60 min), from `public/images/`. */
const PACKAGE_CARD_IMAGES = [
  "/images/tablet.png",
  "/images/mobile.png",
  "/images/desktop.png",
  "/images/laptop.png",
  "/images/laptop.png",
] as const;

type PackageCard = { title: string; description: string; price: string };
type SectionCopy = {
  heading: string;
  subheading: string;
  cta: string;
  promoAnnouncement: string;
  promoBadge: string;
  promoCodeLabel: string;
  promoCopied: string;
  transactionFeeNote: string;
  freeTag: string;
  freePromoCardNote: string;
  packages: PackageCard[];
};

const packagePricesAsc = ["€4.50", "€9.00", "€18.00", "€27.00", "€54.00"];

const sectionCopy: Record<Language, SectionCopy> = {
  en: {
    heading: "Find Peace with Our Consultation Packages",
    subheading: "Our sessions are designed to offer comfort, clarity, and personal guidance, exactly when you need it most.",
    cta: "BOOK NOW",
    promoAnnouncement: "New here? Get a 5-minute session for FREE! Use promo code:",
    promoBadge: "5 MIN FREE • WELCOME5",
    promoCodeLabel: "Copy code",
    promoCopied: "Promo code WELCOME5 copied!",
    transactionFeeNote: "€0.50 transaction fee for every transaction",
    freeTag: "FREE WITH CODE",
    freePromoCardNote: "First session? Use promo code WELCOME5 to get this 5-minute session completely free!",
    packages: [
      {
        title: "5 minutes",
        description:
          "Buy 5 minutes with an experienced coach via chat, audio call, or video call. Ideal for a very quick insight session. Use promo code WELCOME5 for a 5-minute free session!",
        price: packagePricesAsc[0],
      },
      {
        title: "10 minutes",
        description:
          "Buy 10 minutes with an experienced coach via chat, audio call, or video call. Perfect for a quick question or brief advice.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 minutes",
        description:
          "Buy 20 minutes with an experienced coach via chat, audio call, or video call.\nFor peace, clarity, and personal support.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 minutes",
        description: "Buy 30 minutes with a coach via chat, audio call, or video call.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 minutes",
        description: "Buy 60 minutes for an extended, in-depth session with a coach via chat, audio call, or video call.",
        price: packagePricesAsc[4],
      },
    ],
  },
  nl: {
    heading: "Vind Rust met Onze Consultatiepakketten",
    subheading:
      "Onze sessies zijn ontworpen om comfort, helderheid en persoonlijke begeleiding te bieden, precies wanneer jij het nodig hebt.",
    cta: "BOEK NU",
    promoAnnouncement: "Nieuw hier? Krijg een sessie van 5 minuten GRATIS! Gebruik promocode:",
    promoBadge: "5 MIN GRATIS • WELCOME5",
    promoCodeLabel: "Code kopiëren",
    promoCopied: "Promocode WELCOME5 gekopieerd!",
    transactionFeeNote: "€0,50 transactiekosten voor elke transactie",
    freeTag: "GRATIS MET CODE",
    freePromoCardNote: "Eerste sessie? Gebruik promocode WELCOME5 om deze sessie van 5 minuten gratis te krijgen!",
    packages: [
      {
        title: "5 minuten",
        description:
          "Koop 5 minuten met een ervaren coach via chat, audio bellen of video bellen. Ideaal voor een zeer snelle inzichtsessie. Gebruik promocode WELCOME5 voor 5 minuten gratis!",
        price: packagePricesAsc[0],
      },
      {
        title: "10 minuten",
        description:
          "Koop 10 minuten om met een ervaren coach te chatten, audio te bellen of video te bellen. Perfect voor een snelle vraag of kort advies.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 minuten",
        description:
          "Koop 20 minuten om met een ervaren coach te chatten, audio te bellen of video te bellen.\nVoor rust, helderheid en persoonlijke ondersteuning.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 minuten",
        description: "Koop 30 minuten om met een coach te chatten, audio te bellen of video te bellen.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 minuten",
        description:
          "Koop 60 minuten voor een uitgebreide sessie met een coach via chat, audio bellen of video bellen.",
        price: packagePricesAsc[4],
      },
    ],
  },
  fr: {
    heading: "Trouvez la paix avec nos forfaits de consultation",
    subheading:
      "Nos sessions sont conçues pour offrir confort, clarté et accompagnement personnel, exactement quand vous en avez le plus besoin.",
    cta: "RÉSERVER",
    promoAnnouncement: "Nouveau ici ? Obtenez une séance de 5 minutes GRATUITE ! Utilisez le code promo :",
    promoBadge: "5 MIN GRATUITES • WELCOME5",
    promoCodeLabel: "Copier le code",
    promoCopied: "Code promo WELCOME5 copié !",
    transactionFeeNote: "0,50 € de frais pour chaque transaction",
    freeTag: "GRATUIT AVEC CODE",
    freePromoCardNote: "Première séance ? Utilisez le code promo WELCOME5 pour obtenir cette séance de 5 minutes gratuitement !",
    packages: [
      {
        title: "5 minutes",
        description:
          "Achetez 5 minutes avec un coach expérimenté en chat, appel audio ou appel vidéo. Idéal pour un aperçu très rapide. Utilisez le code promo WELCOME5 pour 5 minutes gratuites !",
        price: packagePricesAsc[0],
      },
      {
        title: "10 minutes",
        description:
          "Achetez 10 minutes avec un coach expérimenté en chat, appel audio ou appel vidéo. Parfait pour une question rapide ou un bref conseil.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 minutes",
        description:
          "Achetez 20 minutes avec un coach expérimenté en chat, appel audio ou appel vidéo.\nPour la paix, la clarté et un soutien personnel.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 minutes",
        description: "Achetez 30 minutes avec un coach en chat, appel audio ou appel vidéo.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 minutes",
        description:
          "Achetez 60 minutes pour une séance approfondie avec un coach en chat, appel audio ou appel vidéo.",
        price: packagePricesAsc[4],
      },
    ],
  },
  ar: {
    heading: "ابحث عن السلام مع باقات الاستشارة لدينا",
    subheading: "تم تصميم جلساتنا لتقديم الراحة والوضوح والارشاد الشخصي، في الوقت الذي تحتاجه فيه اكثر.",
    cta: "احجز الان",
    promoAnnouncement: "جديد هنا؟ احصل على جلسة مدتها 5 دقائق مجاناً! استخدم الرمز الترويجي:",
    promoBadge: "5 دقائق مجاناً • WELCOME5",
    promoCodeLabel: "نسخ الرمز",
    promoCopied: "تم نسخ الرمز الترويجي WELCOME5!",
    transactionFeeNote: "0.50 يورو رسوم المعاملة لكل معاملة",
    freeTag: "مجاناً مع الرمز",
    freePromoCardNote: "جلستك الأولى؟ استخدم الرمز الترويجي WELCOME5 للحصول على هذه الجلسة لمدة 5 دقائق مجاناً تماماً!",
    packages: [
      {
        title: "5 دقائق",
        description:
          "اشتر 5 دقائق مع مدرب خبير عبر الدردشة أو المكالمة الصوتية أو مكالمة الفيديو. مثالية لرؤية سريعة جدا. استخدم الرمز الترويجي WELCOME5 للحصول على 5 دقائق مجانا!",
        price: packagePricesAsc[0],
      },
      {
        title: "10 دقائق",
        description:
          "اشتر 10 دقائق مع مدرب خبير عبر الدردشة أو المكالمة الصوتية أو مكالمة الفيديو. مثالية لسؤال سريع او نصيحة قصيرة.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 دقيقة",
        description:
          "اشتر 20 دقيقة مع مدرب خبير عبر الدردشة أو المكالمة الصوتية أو مكالمة الفيديو.\nللسلام والوضوح والدعم الشخصي.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 دقيقة",
        description: "اشتر 30 دقيقة مع مدرب عبر الدردشة أو المكالمة الصوتية أو مكالمة الفيديو.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 دقيقة",
        description: "اشتر 60 دقيقة لجلسة مطولة ومعمقة مع مدرب عبر الدردشة أو المكالمة الصوتية أو مكالمة الفيديو.",
        price: packagePricesAsc[4],
      },
    ],
  },
  zh: {
    heading: "通过我们的咨询套餐找到内心平静",
    subheading: "我们的会话旨在为你提供舒适、清晰和个性化引导，在你最需要的时候出现。",
    cta: "立即预约",
    promoAnnouncement: "新用户专享？免费获得 5 分钟初次体验咨询！使用优惠码：",
    promoBadge: "5 分钟免费 • WELCOME5",
    promoCodeLabel: "复制代码",
    promoCopied: "优惠码 WELCOME5 已复制！",
    transactionFeeNote: "每笔交易加收 €0.50 手续费",
    freeTag: "使用优惠码免费",
    freePromoCardNote: "首次体验？在结账时使用优惠码 WELCOME5 即可免费获取此 5 分钟咨询！",
    packages: [
      {
        title: "5 分钟",
        description:
          "购买 5 分钟，通过聊天、语音通话或视频通话与资深教练交流。非常适合快速洞察。使用优惠码 WELCOME5 即可享受 5 分钟免费！",
        price: packagePricesAsc[0],
      },
      {
        title: "10 分钟",
        description: "购买 10 分钟，通过聊天、语音通话或视频通话与资深教练交流。适合快速提问或简短建议。",
        price: packagePricesAsc[1],
      },
      {
        title: "20 分钟",
        description: "购买 20 分钟，通过聊天、语音通话或视频通话与资深教练交流。\n带来平静、清晰与个性化支持。",
        price: packagePricesAsc[2],
      },
      {
        title: "30 分钟",
        description: "购买 30 分钟，通过聊天、语音通话或视频通话与教练交流。",
        price: packagePricesAsc[3],
      },
      {
        title: "60 分钟",
        description: "购买 60 分钟，通过聊天、语音通话或视频通话进行更深入的教练咨询。",
        price: packagePricesAsc[4],
      },
    ],
  },
  ru: {
    heading: "Найдите покой с нашими пакетами консультаций",
    subheading:
      "Наши сессии созданы, чтобы дать комфорт, ясность и персональное сопровождение именно тогда, когда это нужнее всего.",
    cta: "ЗАПИСАТЬСЯ",
    promoAnnouncement: "Впервые у нас? Получите 5-минутную сессию БЕСПЛАТНО! Промокод:",
    promoBadge: "5 МИН БЕСПЛАТНО • WELCOME5",
    promoCodeLabel: "Скопировать код",
    promoCopied: "Промокод WELCOME5 скопирован!",
    transactionFeeNote: "0,50 € комиссия за каждую транзакцию",
    freeTag: "БЕСПЛАТНО С КОДОМ",
    freePromoCardNote: "Первая сессия? Используйте промокод WELCOME5, чтобы получить эту 5-минутную сессию бесплатно!",
    packages: [
      {
        title: "5 минут",
        description:
          "Купите 5 минут с опытным коучем через чат, аудиозвонок или видеозвонок. Идеально для очень быстрого инсайта. Используйте промокод WELCOME5 для 5 минут бесплатно!",
        price: packagePricesAsc[0],
      },
      {
        title: "10 минут",
        description:
          "Купите 10 минут с опытным коучем через чат, аудиозвонок или видеозвонок. Подходит для быстрого вопроса или краткого совета.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 минут",
        description:
          "Купите 20 минут с опытным коучем через чат, аудиозвонок или видеозвонок.\nДля покоя, ясности и личной поддержки.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 минут",
        description: "Купите 30 минут с коучем через чат, аудиозвонок или видеозвонок.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 минут",
        description:
          "Купите 60 минут для углубленной сессии с коучем через чат, аудиозвонок или видеозвонок.",
        price: packagePricesAsc[4],
      },
    ],
  },
  es: {
    heading: "Encuentra paz con nuestros paquetes de consulta",
    subheading:
      "Nuestras sesiones estan diseñadas para ofrecer confort, claridad y guía personal justo cuando más lo necesitas.",
    cta: "RESERVAR",
    promoAnnouncement: "¿Nuevo por aquí? ¡Obtén una sesión de 5 minutos GRATIS! Usa el código promocional:",
    promoBadge: "5 MIN GRATIS • WELCOME5",
    promoCodeLabel: "Copiar código",
    promoCopied: "¡Código promocional WELCOME5 copiado!",
    transactionFeeNote: "0,50 € de comisión por cada transacción",
    freeTag: "GRATIS CON CÓDIGO",
    freePromoCardNote: "¿Primera sesión? ¡Usa el código promocional WELCOME5 para obtener esta sesión de 5 minutos gratis!",
    packages: [
      {
        title: "5 minutos",
        description:
          "Compra 5 minutos con un coach experimentado por chat, llamada de audio o videollamada. Ideal para una visión muy rápida. ¡Usa el código promocional WELCOME5 para 5 minutos gratis!",
        price: packagePricesAsc[0],
      },
      {
        title: "10 minutos",
        description:
          "Compra 10 minutos con un coach experimentado por chat, llamada de audio o videollamada. Perfecto para una pregunta rápida o consejo breve.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 minutos",
        description:
          "Compra 20 minutos con un coach experimentado por chat, llamada de audio o videollamada.\nPara paz, claridad y apoyo personal.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 minutos",
        description: "Compra 30 minutos con un coach por chat, llamada de audio o videollamada.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 minutos",
        description:
          "Compra 60 minutos para una sesión extendida con un coach por chat, llamada de audio o videollamada.",
        price: packagePricesAsc[4],
      },
    ],
  },
  it: {
    heading: "Trova la pace con i nostri pacchetti di consulto",
    subheading:
      "Le nostre sessioni sono pensate per offrire comfort, chiarezza e guida personale, proprio quando ne hai più bisogno.",
    cta: "PRENOTA ORA",
    promoAnnouncement: "Nuovo utente? Ottieni una sessione di 5 minuti GRATIS! Usa il codice promozionale:",
    promoBadge: "5 MIN GRATIS • WELCOME5",
    promoCodeLabel: "Copia codice",
    promoCopied: "Codice promozionale WELCOME5 copiato!",
    transactionFeeNote: "0,50 € di commissione per ogni transazione",
    freeTag: "GRATIS CON CODICE",
    freePromoCardNote: "Prima sessione? Usa il codice promozionale WELCOME5 per ottenere questa sessione di 5 minuti gratis!",
    packages: [
      {
        title: "5 minuti",
        description:
          "Acquista 5 minuti con un coach esperto via chat, chiamata audio o videochiamata. Ideale per un insight molto rapido. Usa il codice promozionale WELCOME5 per 5 minuti gratis!",
        price: packagePricesAsc[0],
      },
      {
        title: "10 minuti",
        description:
          "Acquista 10 minuti con un coach esperto via chat, chiamata audio o videochiamata. Perfetto per una domanda rapida o un breve consiglio.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 minuti",
        description:
          "Acquista 20 minuti con un coach esperto via chat, chiamata audio o videochiamata.\nPer pace, chiarezza e supporto personale.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 minuti",
        description: "Acquista 30 minuti con un coach via chat, audio o videochiamata.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 minuti",
        description:
          "Acquista 60 minuti per una sessione approfondita con un coach via chat, chiamata audio o videochiamata.",
        price: packagePricesAsc[4],
      },
    ],
  },
  de: {
    heading: "Finde Frieden mit unseren Beratungspaketen",
    subheading:
      "Unsere Sitzungen sind darauf ausgelegt, Trost, Klarheit und persönliche Begleitung zu geben — genau dann, wenn du sie am meisten brauchst.",
    cta: "JETZT BUCHEN",
    promoAnnouncement: "Neu hier? Erhalte eine 5-minütige Sitzung KOSTENLOS! Nutze den Promo-Code:",
    promoBadge: "5 MIN KOSTENLOS • WELCOME5",
    promoCodeLabel: "Code kopieren",
    promoCopied: "Promo-Code WELCOME5 kopiert!",
    transactionFeeNote: "0,50 € Transaktionsgebühr für jede Transaktion",
    freeTag: "GRATIS MIT CODE",
    freePromoCardNote: "Erste Sitzung? Nutze den Promo-Code WELCOME5, um diese 5-minütige Sitzung kostenlos zu erhalten!",
    packages: [
      {
        title: "5 Minuten",
        description:
          "Kaufe 5 Minuten mit einem erfahrenen Coach per Chat, Audioanruf oder Videoanruf. Ideal für einen schnellen Impuls. Nutze den Promo-Code WELCOME5 für 5 kostenlose Minuten!",
        price: packagePricesAsc[0],
      },
      {
        title: "10 Minuten",
        description:
          "Kaufe 10 Minuten mit einem erfahrenen Coach per Chat, Audioanruf oder Videoanruf. Perfekt für eine kurze Frage oder kurzen Rat.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 Minuten",
        description:
          "Kaufe 20 Minuten mit einem erfahrenen Coach per Chat, Audioanruf oder Videoanruf.\nFür Frieden, Klarheit und persönliche Unterstützung.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 Minuten",
        description: "Kaufe 30 Minuten mit einem Coach per Chat, Audioanruf oder Videoanruf.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 Minuten",
        description:
          "Kaufe 60 Minuten für eine ausführliche, tiefgehende Sitzung mit einem Coach per Chat, Audioanruf oder Videoanruf.",
        price: packagePricesAsc[4],
      },
    ],
  },
  ro: {
    heading: "Găsește Pacea cu Pachetele Noastre de Consultanță",
    subheading:
      "Sesiunile noastre sunt concepute pentru a oferi confort, claritate și îndrumare personală, exact atunci când ai cea mai mare nevoie.",
    cta: "REZERVĂ ACUM",
    promoAnnouncement: "Nou aici? Primești o sesiune de 5 minute GRATUIT! Folosește codul promoțional:",
    promoBadge: "5 MIN GRATUIT • WELCOME5",
    promoCodeLabel: "Copiază codul",
    promoCopied: "Codul promoțional WELCOME5 a fost copiat!",
    transactionFeeNote: "0,50 € comision pentru fiecare tranzacție",
    freeTag: "GRATUIT CU COD",
    freePromoCardNote: "Prima sesiune? Folosește codul promoțional WELCOME5 pentru a primi această sesiune de 5 minute gratuit!",
    packages: [
      {
        title: "5 minute",
        description:
          "Cumpără 5 minute cu un coach experimentat prin chat, apel audio sau apel video. Ideal pentru o scurtă perspectivă. Folosește codul promoțional WELCOME5 pentru 5 minute gratuite!",
        price: packagePricesAsc[0],
      },
      {
        title: "10 minute",
        description:
          "Cumpără 10 minute cu un coach experimentat prin chat, apel audio sau apel video. Perfect pentru o întrebare rapidă sau un sfat scurt.",
        price: packagePricesAsc[1],
      },
      {
        title: "20 minute",
        description:
          "Cumpără 20 de minute cu un coach experimentat prin chat, apel audio sau apel video.\nPentru liniște, claritate și sprijin personal.",
        price: packagePricesAsc[2],
      },
      {
        title: "30 minute",
        description: "Cumpără 30 de minute cu un coach prin chat, apel audio sau apel video.",
        price: packagePricesAsc[3],
      },
      {
        title: "60 minute",
        description:
          "Cumpără 60 de minute pentru o sesiune extinsă și aprofundată cu un coach prin chat, apel audio sau apel video.",
        price: packagePricesAsc[4],
      },
    ],
  },
};

const ConsultationPackagesSection = () => {
  const { language } = useLanguage();
  const copy = sectionCopy[language] ?? sectionCopy.en;
  const [copied, setCopied] = useState(false);

  const handleCopyPromo = async () => {
    try {
      await navigator.clipboard.writeText("WELCOME5");
      setCopied(true);
      toast.success(copy.promoCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.success(copy.promoCopied);
    }
  };

  return (
    <section id="pricing" className="relative py-24 md:py-32 w-full overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full">
        <img
          src="/I_want_create_a_image_202605052136.jpeg"
          alt=""
          className="w-full h-full object-cover brightness-[0.4]"
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 max-w-[1200px]">
        <div className="text-center mb-14 md:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold tracking-tight text-white mb-4">
            {copy.heading}
          </h2>
          <p className="text-white/90 text-base md:text-lg max-w-2xl mx-auto font-light mb-6">
            {copy.subheading}
          </p>

          {/* Promo code announcement callout */}
          <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-2.5 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-sm text-white shadow-xl backdrop-blur-md sm:max-w-2xl sm:flex-row sm:flex-wrap sm:justify-center sm:rounded-full sm:px-5 sm:py-2.5 md:text-base">
            <span className="inline-flex min-w-0 items-center justify-center gap-2 text-pretty text-center sm:text-left">
              <Gift className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="font-light leading-snug">{copy.promoAnnouncement}</span>
            </span>
            <button
              type="button"
              onClick={handleCopyPromo}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#E2E5D3] px-3 py-1 font-mono text-xs font-bold tracking-wider text-[#2C3E2D] shadow-sm transition-all hover:bg-[#d6d8c6] active:scale-95 cursor-pointer"
              title={copy.promoCodeLabel}
            >
              <span>WELCOME5</span>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-700" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-[#2C3E2D]/70" />
              )}
            </button>
          </div>
        </div>

        <div className="mx-auto grid max-w-sm grid-cols-1 gap-6 sm:max-w-none sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 lg:gap-8">
          {copy.packages.map((pkg, i) => (
            <div
              key={i}
              className="relative flex min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-2xl transition-transform duration-300 hover:scale-[1.02]"
            >
              {/* Promo Badge for 5-minute package */}
              {i === 0 && (
                <div className="absolute top-3 left-3 z-10">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase bg-[#2C3E2D] text-[#E2E5D3] rounded-full shadow-lg border border-[#E2E5D3]/40">
                    <Gift className="w-3 h-3 text-[#E2E5D3]" />
                    {copy.promoBadge}
                  </span>
                </div>
              )}

              <div className="relative h-48 w-full sm:h-56 lg:h-52 xl:h-44">
                <img src={PACKAGE_CARD_IMAGES[i]} alt={pkg.title} className="h-full w-full object-cover" />
              </div>

              <div className="flex flex-1 flex-col px-5 pb-6 pt-8 sm:px-7 sm:pb-8 sm:pt-10">
                <div className="mb-3 flex min-w-0 items-center gap-2.5">
                  <Clock className="h-5 w-5 shrink-0 text-foreground/60" />
                  <h3 className="min-w-0 break-words font-serif text-xl sm:text-2xl">{pkg.title}</h3>
                </div>

                <p className="text-sm text-foreground/70 mb-6 flex-1 whitespace-pre-line leading-relaxed">
                  {pkg.description}
                </p>

                <div className="mb-6 pt-3 border-t border-border/50">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-[1.35rem] font-medium text-foreground/90 leading-none">{pkg.price}</p>
                    {i === 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {copy.freeTag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/60 mt-1.5 leading-snug">
                    {copy.transactionFeeNote}
                  </p>
                  {i === 0 && (
                    <div className="mt-2.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-start gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span className="leading-snug font-medium">
                        {copy.freePromoCardNote}
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  to="/user/register"
                  className="block w-full py-3.5 bg-[#E2E5D3] hover:bg-[#d6d8c6] text-foreground/80 text-sm font-semibold tracking-widest transition-colors rounded-sm text-center"
                >
                  {copy.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ConsultationPackagesSection;
