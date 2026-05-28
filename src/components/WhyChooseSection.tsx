import { Leaf, Compass, Link as LinkIcon, UserCheck, Zap } from "lucide-react";
import aboutImg from "@/assets/about-img.jpg";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

type WhyChooseCard = { title: string; desc: string };
type WhyChooseBlock = {
  id: string;
  title: string;
  cards: [WhyChooseCard, WhyChooseCard];
};

const whyChooseCopy: Record<Language, [WhyChooseBlock, WhyChooseBlock, WhyChooseBlock]> = {
  en: [
    {
      id: "01",
      title: "Self-development",
      cards: [
        {
          title: "Spiritual Depth",
          desc: "Every consultation offers more than answers — it helps you grow in awareness and inner strength.",
        },
        {
          title: "Your Life Path at the Center",
          desc: "No standard answers, but guidance that truly aligns with your unique life journey.",
        },
      ],
    },
    {
      id: "02",
      title: "Freedom of choice",
      cards: [
        {
          title: "Intuitive Connection",
          desc: "We connect you with mediums who truly suit you, so that every session feels personal.",
        },
        {
          title: "Flexible and Personal",
          desc: "Choose your moment, your medium, your pace — with credits, you stay in control.",
        },
      ],
    },
    {
      id: "03",
      title: "Security",
      cards: [
        {
          title: "Healing Energy",
          desc: "Our services are tailored to balance and healing — for body, mind, and soul.",
        },
        {
          title: "Safe Space",
          desc: "Your conversations are completely private and protected. Here you can be yourself, without judgment.",
        },
      ],
    },
  ],
  nl: [
    {
      id: "01",
      title: "Zelfontwikkeling",
      cards: [
        {
          title: "Spirituele Diepgang",
          desc: "Elke consultatie biedt meer dan antwoorden — het helpt je groeien in bewustzijn en innerlijke kracht.",
        },
        {
          title: "Jouw Levenspad Centraal",
          desc: "Geen standaardantwoorden, maar begeleiding die echt aansluit bij jouw unieke levensreis.",
        },
      ],
    },
    {
      id: "02",
      title: "Vrijheid van keuze",
      cards: [
        {
          title: "Intuïtieve Verbinding",
          desc: "Wij verbinden je met mediums die echt bij je passen, zodat elke sessie persoonlijk aanvoelt.",
        },
        {
          title: "Flexibel en Persoonlijk",
          desc: "Kies je moment, je medium, je tempo — met credits houd jij de regie.",
        },
      ],
    },
    {
      id: "03",
      title: "Veiligheid",
      cards: [
        {
          title: "Helende Energie",
          desc: "Onze diensten zijn afgestemd op balans en heling — voor lichaam, geest en ziel.",
        },
        {
          title: "Veilige Ruimte",
          desc: "Jouw gesprekken zijn volledig privé en beschermd. Hier kun je jezelf zijn, zonder oordeel.",
        },
      ],
    },
  ],
  fr: [
    {
      id: "01",
      title: "Developpement personnel",
      cards: [
        { title: "Profondeur spirituelle", desc: "Chaque consultation offre plus que des reponses — elle vous aide a grandir en conscience et en force interieure." },
        { title: "Votre chemin de vie au centre", desc: "Pas de reponses standard, mais un accompagnement vraiment aligne avec votre parcours unique." },
      ],
    },
    {
      id: "02",
      title: "Liberte de choix",
      cards: [
        { title: "Connexion intuitive", desc: "Nous vous mettons en relation avec des mediums qui vous correspondent vraiment, pour que chaque seance soit personnelle." },
        { title: "Flexible et personnel", desc: "Choisissez votre moment, votre medium, votre rythme — avec les credits, vous gardez le controle." },
      ],
    },
    {
      id: "03",
      title: "Securite",
      cards: [
        { title: "Energie de guerison", desc: "Nos services sont concus pour apporter equilibre et guerison — pour le corps, l'esprit et l'ame." },
        { title: "Espace sur", desc: "Vos conversations sont totalement privees et protegees. Ici, vous pouvez etre vous-meme, sans jugement." },
      ],
    },
  ],
  ar: [
    {
      id: "01",
      title: "تطوير الذات",
      cards: [
        { title: "عمق روحي", desc: "كل استشارة تقدم اكثر من الاجابات - فهي تساعدك على النمو في الوعي والقوة الداخلية." },
        { title: "مسار حياتك في المركز", desc: "لا اجابات نمطية، بل ارشاد يتماشى فعلا مع رحلتك الحياتية الفريدة." },
      ],
    },
    {
      id: "02",
      title: "حرية الاختيار",
      cards: [
        { title: "اتصال حدسي", desc: "نوصلك بمرشدين يناسبونك فعلا، حتى تشعر ان كل جلسة شخصية." },
        { title: "مرن وشخصي", desc: "اختر وقتك ومرشدك وايقاعك - ومع الرصيد تبقى انت المتحكم." },
      ],
    },
    {
      id: "03",
      title: "الامان",
      cards: [
        { title: "طاقة شافية", desc: "خدماتنا مصممة لتحقيق التوازن والشفاء - للجسد والعقل والروح." },
        { title: "مساحة آمنة", desc: "محادثاتك خاصة ومحميّة بالكامل. هنا يمكنك ان تكون نفسك بلا احكام." },
      ],
    },
  ],
  zh: [
    {
      id: "01",
      title: "自我成长",
      cards: [
        { title: "灵性深度", desc: "每次咨询不仅提供答案，更帮助你提升觉察与内在力量。" },
        { title: "以你的人生道路为中心", desc: "不是标准答案，而是与你独特人生旅程真正契合的指引。" },
      ],
    },
    {
      id: "02",
      title: "自由选择",
      cards: [
        { title: "直觉连接", desc: "我们为你匹配真正适合你的灵媒，让每次会话都更有个人感。" },
        { title: "灵活且个性化", desc: "选择你的时间、灵媒与节奏 - 使用积分，你始终掌握主动权。" },
      ],
    },
    {
      id: "03",
      title: "安全保障",
      cards: [
        { title: "疗愈能量", desc: "我们的服务围绕平衡与疗愈而设计 - 面向身、心、灵。" },
        { title: "安全空间", desc: "你的对话完全私密且受保护。在这里，你可以不被评判地做自己。" },
      ],
    },
  ],
  ru: [
    {
      id: "01",
      title: "Саморазвитие",
      cards: [
        { title: "Духовная глубина", desc: "Каждая консультация дает больше, чем ответы — она помогает расти в осознанности и внутренней силе." },
        { title: "Ваш жизненный путь в центре", desc: "Не шаблонные ответы, а сопровождение, которое действительно соответствует вашему уникальному пути." },
      ],
    },
    {
      id: "02",
      title: "Свобода выбора",
      cards: [
        { title: "Интуитивная связь", desc: "Мы соединяем вас с медиумами, которые действительно вам подходят, чтобы каждая сессия ощущалась личной." },
        { title: "Гибко и персонально", desc: "Выбирайте время, медиума и темп — с кредитами контроль остается у вас." },
      ],
    },
    {
      id: "03",
      title: "Безопасность",
      cards: [
        { title: "Исцеляющая энергия", desc: "Наши услуги направлены на баланс и исцеление — для тела, разума и души." },
        { title: "Безопасное пространство", desc: "Ваши разговоры полностью приватны и защищены. Здесь вы можете быть собой без осуждения." },
      ],
    },
  ],
  es: [
    {
      id: "01",
      title: "Desarrollo personal",
      cards: [
        { title: "Profundidad espiritual", desc: "Cada consulta ofrece mas que respuestas: te ayuda a crecer en conciencia y fuerza interior." },
        { title: "Tu camino de vida en el centro", desc: "No hay respuestas estandar, sino orientacion alineada con tu viaje unico." },
      ],
    },
    {
      id: "02",
      title: "Libertad de eleccion",
      cards: [
        { title: "Conexion intuitiva", desc: "Te conectamos con mediums que realmente encajan contigo, para que cada sesion se sienta personal." },
        { title: "Flexible y personal", desc: "Elige tu momento, tu medium y tu ritmo; con creditos, tu mantienes el control." },
      ],
    },
    {
      id: "03",
      title: "Seguridad",
      cards: [
        { title: "Energia sanadora", desc: "Nuestros servicios estan pensados para equilibrar y sanar cuerpo, mente y alma." },
        { title: "Espacio seguro", desc: "Tus conversaciones son totalmente privadas y protegidas. Aqui puedes ser tu mismo, sin juicio." },
      ],
    },
  ],
};

const WhyChooseSection = () => {
  const { language } = useLanguage();
  const blocks = whyChooseCopy[language] ?? whyChooseCopy.en;
  const selfDevelopmentImg = "/self-development.jpeg";
  const freedomOfChoiceImg = "/change_the_image_of_man_202605130804.jpeg";
  const blockImages = [selfDevelopmentImg, freedomOfChoiceImg, aboutImg] as const;
  const blockIcons = [
    [Leaf, Compass],
    [LinkIcon, UserCheck],
    [Zap, null],
  ] as const;
  const blockCustomIcons = [
    [null, null],
    [null, null],
    [null, "/images/handshake-shield.png"],
  ] as const;

  return (
    <section id="why-choose" className="relative w-full bg-cream">
      {blocks.map((block, index) => (
        <div 
          key={block.id} 
          className="sticky top-0 h-screen w-full flex flex-col justify-center overflow-hidden bg-cream shadow-[0_-10px_30px_rgba(0,0,0,0.05)]"
          style={{ zIndex: index }}
        >
          <div className="container mx-auto px-6 lg:max-w-[1200px] w-full">
            {/* Title */}
            <div className="text-center mb-12">
              <span className="text-lg font-medium text-foreground/80">{block.id} {block.title}</span>
              <div className="w-64 h-[1px] bg-gradient-to-r from-transparent via-foreground/30 to-transparent mx-auto mt-4"></div>
            </div>

            <div className="grid md:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-center">
              {/* Left: Cards */}
              <div className="grid sm:grid-cols-2 gap-6">
                {block.cards.map((card, i) => {
                  const Icon = blockIcons[index][i];
                  const customIcon = blockCustomIcons[index][i];
                  return (
                    <div key={i} className="bg-white rounded-3xl p-8 text-center shadow-sm hover:shadow-md transition-shadow duration-300">
                      <div className="mx-auto mb-6 flex items-center justify-center">
                        {customIcon ? (
                          <img
                            src={customIcon}
                            alt=""
                            className="h-24 w-24 max-w-none object-contain"
                            aria-hidden
                          />
                        ) : Icon ? (
                          <Icon className="h-12 w-12 text-foreground/70" />
                        ) : null}
                      </div>
                      <h3 className="mb-4 text-2xl font-serif font-semibold">{card.title}</h3>
                      <p className="text-foreground/60 leading-relaxed text-[15px]">{card.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Right: Image */}
              <div className="relative h-[350px] lg:h-[450px] w-full hidden md:block">
                <div
                  className="absolute inset-0 w-full h-full rounded-3xl bg-[#7a8570]"
                  style={{ transform: "translate(12px, 12px)" }}
                  aria-hidden
                />
                <div className="absolute inset-0 w-full h-full overflow-hidden rounded-3xl shadow-lg">
                  <img
                    src={blockImages[index]}
                    alt={block.title}
                    className="h-full w-full object-cover object-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
};

export default WhyChooseSection;
