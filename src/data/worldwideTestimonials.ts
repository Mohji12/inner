/**
 * Rotating home-page quotes in several languages (voices worldwide).
 * Shown regardless of UI language; each line uses `htmlLang` for screen readers & typography.
 */
export type WorldwideTestimonial = {
  name: string;
  text: string;
  /** BCP 47 language tag for the quote */
  htmlLang: string;
  /** Short label, e.g. for a small badge */
  label: string;
};

export const worldwideTestimonials: readonly WorldwideTestimonial[] = [
  {
    name: "Marieke de Vries",
    text: "The sessions helped me reconnect with myself. A wonderful experience.",
    htmlLang: "en",
    label: "EN",
  },
  {
    name: "Thomas Bakker",
    text: "De sessies brachten me dichter bij mezelf—warm, eerlijk en precies wat ik nodig had.",
    htmlLang: "nl",
    label: "NL",
  },
  {
    name: "Camille Rousseau",
    text: "J’ai retrouvé calme et clarté. Un accompagnement profond et respectueux.",
    htmlLang: "fr",
    label: "FR",
  },
  {
    name: "Elena García",
    text: "Desde la primera sesión sentí más paz. Un espacio seguro y muy recomendable.",
    htmlLang: "es",
    label: "ES",
  },
  {
    name: "Julia Weber",
    text: "Endlich wieder bei mir angekommen—achtsam begleitet und ohne Urteil.",
    htmlLang: "de",
    label: "DE",
  },
  {
    name: "Ana Costa",
    text: "Um lugar acolhedor onde pude ser eu mesma. Recomendo de coração.",
    htmlLang: "pt",
    label: "PT",
  },
  {
    name: "山田 美咲",
    text: "落ち着いて自分と向き合えました。安心して利用できます。",
    htmlLang: "ja",
    label: "JA",
  },
  {
    name: "أحمد الخالدي",
    text: "جلسات هادئة ومفيدة—شعرت بأمان وثقة منذ البداية.",
    htmlLang: "ar",
    label: "AR",
  },
  {
    name: "Priya Sharma",
    text: "सत्रों ने मुझे भीतर से शांति महसूस कराई। बहुत सकारात्मक अनुभव।",
    htmlLang: "hi",
    label: "HI",
  },
  {
    name: "Li Wei",
    text: "在这里我感到很被接纳，内心也更平静了。",
    htmlLang: "zh",
    label: "ZH",
  },
  {
    name: "Мария Иванова",
    text: "Тёплое сопровождение и ясность после каждой встречи. Очень благодарна.",
    htmlLang: "ru",
    label: "RU",
  },
];
