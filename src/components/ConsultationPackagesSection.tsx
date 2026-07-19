import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
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
type SectionCopy = { heading: string; subheading: string; cta: string; packages: PackageCard[] };

const packagePricesAsc = ["€5.00", "€10.00", "€20.00", "€27.00", "€54.00"];

const sectionCopy: Record<Language, SectionCopy> = {
  en: {
    heading: "Find Peace with Our Consultation Packages",
    subheading: "Our sessions are designed to offer comfort, clarity, and personal guidance, exactly when you need it most.",
    cta: "BOOK NOW",
    packages: [
      { title: "5 minutes", description: "Buy 5 minutes to chat with an experienced medium. Ideal for a very quick insight.", price: packagePricesAsc[0] },
      { title: "10 minutes", description: "Buy 10 minutes to chat with an experienced medium. Perfect for a quick question or brief advice.", price: packagePricesAsc[1] },
      { title: "20 minutes", description: "Buy 20 minutes to chat with an experienced medium.\nFor peace, clarity, and personal support.", price: packagePricesAsc[2] },
      { title: "30 minutes", description: "Buy 30 minutes to chat with a medium.", price: packagePricesAsc[3] },
      { title: "60 minutes", description: "Buy 60 minutes for an extended, in-depth session with a medium.", price: packagePricesAsc[4] },
    ],
  },
  nl: {
    heading: "Vind Rust met Onze Consultatiepakketten",
    subheading: "Onze sessies zijn ontworpen om comfort, helderheid en persoonlijke begeleiding te bieden, precies wanneer jij het nodig hebt.",
    cta: "BOEK NU",
    packages: [
      { title: "5 minuten", description: "Koop 5 minuten om met een ervaren medium te chatten. Ideaal voor een zeer snelle inzichtsessie.", price: packagePricesAsc[0] },
      { title: "10 minuten", description: "Koop 10 minuten om met een ervaren medium te chatten. Perfect voor een snelle vraag of kort advies.", price: packagePricesAsc[1] },
      { title: "20 minuten", description: "Koop 20 minuten om met een ervaren medium te chatten.\nVoor rust, helderheid en persoonlijke ondersteuning.", price: packagePricesAsc[2] },
      { title: "30 minuten", description: "Koop 30 minuten om met een medium te chatten.", price: packagePricesAsc[3] },
      { title: "60 minuten", description: "Koop 60 minuten voor een uitgebreide sessie met een medium.", price: packagePricesAsc[4] },
    ],
  },
  fr: {
    heading: "Trouvez la paix avec nos forfaits de consultation",
    subheading: "Nos sessions sont concues pour offrir confort, clarte et accompagnement personnel, exactement quand vous en avez le plus besoin.",
    cta: "RESERVER",
    packages: [
      { title: "5 minutes", description: "Achetez 5 minutes pour discuter avec un medium experimente. Ideal pour un apercu tres rapide.", price: packagePricesAsc[0] },
      { title: "10 minutes", description: "Achetez 10 minutes pour discuter avec un medium experimente. Parfait pour une question rapide ou un bref conseil.", price: packagePricesAsc[1] },
      { title: "20 minutes", description: "Achetez 20 minutes pour discuter avec un medium experimente.\nPour la paix, la clarte et un soutien personnel.", price: packagePricesAsc[2] },
      { title: "30 minutes", description: "Achetez 30 minutes pour discuter avec un medium.", price: packagePricesAsc[3] },
      { title: "60 minutes", description: "Achetez 60 minutes pour une seance approfondie avec un medium.", price: packagePricesAsc[4] },
    ],
  },
  ar: {
    heading: "ابحث عن السلام مع باقات الاستشارة لدينا",
    subheading: "تم تصميم جلساتنا لتقديم الراحة والوضوح والارشاد الشخصي، في الوقت الذي تحتاجه فيه اكثر.",
    cta: "احجز الان",
    packages: [
      { title: "5 دقائق", description: "اشتر 5 دقائق للدردشة مع مرشد روحاني خبير. مثالية لرؤية سريعة جدا.", price: packagePricesAsc[0] },
      { title: "10 دقائق", description: "اشتر 10 دقائق للدردشة مع مرشد روحاني خبير. مثالية لسؤال سريع او نصيحة قصيرة.", price: packagePricesAsc[1] },
      { title: "20 دقيقة", description: "اشتر 20 دقيقة للدردشة مع مرشد روحاني خبير.\nللسلام والوضوح والدعم الشخصي.", price: packagePricesAsc[2] },
      { title: "30 دقيقة", description: "اشتر 30 دقيقة للدردشة مع مرشد روحاني.", price: packagePricesAsc[3] },
      { title: "60 دقيقة", description: "اشتر 60 دقيقة لجلسة مطولة ومعمقة مع مرشد روحاني.", price: packagePricesAsc[4] },
    ],
  },
  zh: {
    heading: "通过我们的咨询套餐找到内心平静",
    subheading: "我们的会话旨在为你提供舒适、清晰和个性化引导，在你最需要的时候出现。",
    cta: "立即预约",
    packages: [
      { title: "5 分钟", description: "购买 5 分钟与资深灵媒聊天。非常适合快速获得洞察。", price: packagePricesAsc[0] },
      { title: "10 分钟", description: "购买 10 分钟与资深灵媒聊天。适合快速提问或简短建议。", price: packagePricesAsc[1] },
      { title: "20 分钟", description: "购买 20 分钟与资深灵媒聊天。\n带来平静、清晰与个性化支持。", price: packagePricesAsc[2] },
      { title: "30 分钟", description: "购买 30 分钟与灵媒聊天。", price: packagePricesAsc[3] },
      { title: "60 分钟", description: "购买 60 分钟，进行更深入的灵媒咨询。", price: packagePricesAsc[4] },
    ],
  },
  ru: {
    heading: "Найдите покой с нашими пакетами консультаций",
    subheading: "Наши сессии созданы, чтобы дать комфорт, ясность и персональное сопровождение именно тогда, когда это нужнее всего.",
    cta: "ЗАПИСАТЬСЯ",
    packages: [
      { title: "5 минут", description: "Купите 5 минут для чата с опытным медиумом. Идеально для очень быстрого инсайта.", price: packagePricesAsc[0] },
      { title: "10 минут", description: "Купите 10 минут для чата с опытным медиумом. Подходит для быстрого вопроса или краткого совета.", price: packagePricesAsc[1] },
      { title: "20 минут", description: "Купите 20 минут для чата с опытным медиумом.\nДля покоя, ясности и личной поддержки.", price: packagePricesAsc[2] },
      { title: "30 минут", description: "Купите 30 минут для чата с медиумом.", price: packagePricesAsc[3] },
      { title: "60 минут", description: "Купите 60 минут для углубленной сессии с медиумом.", price: packagePricesAsc[4] },
    ],
  },
  es: {
    heading: "Encuentra paz con nuestros paquetes de consulta",
    subheading: "Nuestras sesiones estan disenadas para ofrecer confort, claridad y guia personal justo cuando mas lo necesitas.",
    cta: "RESERVAR",
    packages: [
      { title: "5 minutos", description: "Compra 5 minutos para chatear con un medium experimentado. Ideal para una vision muy rapida.", price: packagePricesAsc[0] },
      { title: "10 minutos", description: "Compra 10 minutos para chatear con un medium experimentado. Perfecto para una pregunta rapida o consejo breve.", price: packagePricesAsc[1] },
      { title: "20 minutos", description: "Compra 20 minutos para chatear con un medium experimentado.\nPara paz, claridad y apoyo personal.", price: packagePricesAsc[2] },
      { title: "30 minutos", description: "Compra 30 minutos para chatear con un medium.", price: packagePricesAsc[3] },
      { title: "60 minutos", description: "Compra 60 minutos para una sesion extendida con un medium.", price: packagePricesAsc[4] },
    ],
  },
  it: {
    heading: "Trova la pace con i nostri pacchetti di consulto",
    subheading: "Le nostre sessioni sono pensate per offrire comfort, chiarezza e guida personale, proprio quando ne hai più bisogno.",
    cta: "PRENOTA ORA",
    packages: [
      { title: "5 minuti", description: "Acquista 5 minuti per chattare con un medium esperto. Ideale per un insight molto rapido.", price: packagePricesAsc[0] },
      { title: "10 minuti", description: "Acquista 10 minuti per chattare con un medium esperto. Perfetto per una domanda rapida o un breve consiglio.", price: packagePricesAsc[1] },
      { title: "20 minuti", description: "Acquista 20 minuti per chattare con un medium esperto.\nPer pace, chiarezza e supporto personale.", price: packagePricesAsc[2] },
      { title: "30 minuti", description: "Acquista 30 minuti per chattare con un medium.", price: packagePricesAsc[3] },
      { title: "60 minuti", description: "Acquista 60 minuti per una sessione approfondita con un medium.", price: packagePricesAsc[4] },
    ],
  },
  de: {
    heading: "Finde Frieden mit unseren Beratungspaketen",
    subheading: "Unsere Sitzungen sind darauf ausgelegt, Trost, Klarheit und persönliche Begleitung zu geben — genau dann, wenn du sie am meisten brauchst.",
    cta: "JETZT BUCHEN",
    packages: [
      { title: "5 Minuten", description: "Kaufe 5 Minuten Chat mit einem erfahrenen Medium. Ideal für einen sehr schnellen Impuls.", price: packagePricesAsc[0] },
      { title: "10 Minuten", description: "Kaufe 10 Minuten Chat mit einem erfahrenen Medium. Perfekt für eine kurze Frage oder kurzen Rat.", price: packagePricesAsc[1] },
      { title: "20 Minuten", description: "Kaufe 20 Minuten Chat mit einem erfahrenen Medium.\nFür Frieden, Klarheit und persönliche Unterstützung.", price: packagePricesAsc[2] },
      { title: "30 Minuten", description: "Kaufe 30 Minuten Chat mit einem Medium.", price: packagePricesAsc[3] },
      { title: "60 Minuten", description: "Kaufe 60 Minuten für eine ausführliche, tiefgehende Sitzung mit einem Medium.", price: packagePricesAsc[4] },
    ],
  },
};

const ConsultationPackagesSection = () => {
  const { language } = useLanguage();
  const copy = sectionCopy[language] ?? sectionCopy.en;

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
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-semibold tracking-tight text-white mb-4">
            {copy.heading}
          </h2>
          <p className="text-white/90 text-base md:text-lg max-w-2xl mx-auto font-light">
            {copy.subheading}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 lg:gap-8">
          {copy.packages.map((pkg, i) => (
            <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-transform duration-300 hover:scale-[1.02]">
              <div className="relative h-64 w-full">
                <img
                  src={PACKAGE_CARD_IMAGES[i]}
                  alt={pkg.title}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="pt-12 px-8 pb-8 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-5 h-5 text-foreground/60" />
                  <h3 className="text-2xl font-serif">{pkg.title}</h3>
                </div>
                
                <p className="text-sm text-foreground/70 mb-8 flex-1 whitespace-pre-line leading-relaxed">
                  {pkg.description}
                </p>
                
                <p className="text-[1.35rem] font-medium text-foreground/80 mb-6">{pkg.price}</p>
                
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
