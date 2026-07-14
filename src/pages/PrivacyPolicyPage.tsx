import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Language } from "@/i18n/translations";

const legalUiCopy: Record<Language, { back: string; title: string; fallback: string }> = {
  en: {
    back: "Back",
    title: "Privacy Policy",
    fallback: "Note: This document is currently provided in English for your selected language.",
  },
  fr: {
    back: "Retour",
    title: "Politique de confidentialite",
    fallback: "Remarque : ce document est actuellement disponible en anglais pour la langue selectionnee.",
  },
  nl: {
    back: "Terug",
    title: "Privacyverklaring",
    fallback: "Let op: dit document is momenteel in het Engels beschikbaar voor de gekozen taal.",
  },
  ar: {
    back: "رجوع",
    title: "سياسة الخصوصية",
    fallback: "ملاحظة: هذا المستند متاح حاليا باللغة الانجليزية للغة التي اخترتها.",
  },
  zh: {
    back: "返回",
    title: "隐私政策",
    fallback: "说明：当前所选语言仅提供英文版本。",
  },
  ru: {
    back: "Назад",
    title: "Политика конфиденциальности",
    fallback: "Примечание: для выбранного языка этот документ пока доступен только на английском.",
  },
  es: {
    back: "Volver",
    title: "Politica de privacidad",
    fallback: "Nota: este documento esta disponible actualmente en ingles para el idioma seleccionado.",
  },
};

const PrivacyPolicyNL = () => (
  <>
    <h2 className="text-xl font-semibold mt-8 mb-4">Inleiding</h2>
    <p className="mb-4">Mijn Levenspad, onderdeel van Purush Besakih, gevestigd aan Waldorpstraat 1594, 2521 CZ te ’s-Gravenhage en ingeschreven in het Handelsregister onder KvK-nummer 82878692, verwerkt persoonsgegevens van bezoekers en gebruikers van haar platform, waaronder cliënten en coaches, alsook van andere personen met wie in het kader van de dienstverlening contact bestaat. Mijn Levenspad hecht waarde aan een zorgvuldige omgang met persoonsgegevens en verwerkt deze gegevens in overeenstemming met de Algemene verordening gegevensbescherming en de overige toepasselijke wet- en regelgeving.</p>
    <p className="mb-4">Deze privacyverklaring is van toepassing op alle verwerkingen van persoonsgegevens door Mijn Levenspad in verband met het gebruik van www.mijnlevenspad.com en de eventuele mobiele applicatie (hierna: het platform), het aanmaken en gebruiken van accounts, het faciliteren van sessies tussen cliënten en coaches, het aanbieden van content, het verkopen en leveren van producten, het verwerken van betalingen, het onderhouden van contact met gebruikers en het verzenden van eventuele nieuwsbrieven of andere marketingcommunicatie.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Verwerkingsverantwoordelijke</h2>
    <p className="mb-4">De verwerkingsverantwoordelijke voor de verwerking van persoonsgegevens is Mijn Levenspad, onderdeel van Purush Besakih, gevestigd aan Waldorpstraat 1594, 2521 CZ te ’s-Gravenhage, ingeschreven in het Handelsregister onder KvK-nummer 82878692. Voor vragen over deze privacyverklaring of over de verwerking van persoonsgegevens kan contact worden opgenomen met Mijn Levenspad via de contactgegevens op het platform.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Van wie persoonsgegevens worden verwerkt</h2>
    <p className="mb-4">Mijn Levenspad verwerkt persoonsgegevens van cliënten, coaches, bezoekers van het platform, personen die een account aanmaken of willen aanmaken, personen die een sessie boeken of verzorgen, personen die content afnemen, personen die producten bestellen, personen die contact opnemen met Mijn Levenspad en andere personen van wie persoonsgegevens in het kader van de dienstverlening of bedrijfsvoering worden ontvangen.</p>
    <p className="mb-4">Indien een cliënt of coach persoonsgegevens van een andere persoon aan Mijn Levenspad verstrekt, gaat Mijn Levenspad ervan uit dat die persoon bevoegd is die gegevens te verstrekken en de betreffende betrokkene daarover adequaat heeft geïnformeerd.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Hoe persoonsgegevens worden verkregen</h2>
    <p className="mb-4">Mijn Levenspad verkrijgt persoonsgegevens in beginsel rechtstreeks van de betrokkene zelf, bijvoorbeeld wanneer een cliënt of coach een account aanmaakt, profielgegevens invult, een sessie boekt of aanbiedt, credits aanschaft, content afneemt, een product bestelt, contact opneemt, een betaling verricht of anderszins gebruik maakt van het platform.</p>
    <p className="mb-4">Daarnaast kan Mijn Levenspad persoonsgegevens verkrijgen die ontstaan door het gebruik van het platform, zoals loggegevens, technische gebruiksgegevens en cookiegegevens, voor zover daarvan gebruik wordt gemaakt.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Welke persoonsgegevens worden verwerkt</h2>
    <p className="mb-4">Afhankelijk van de aard van het contact en de dienstverlening kan Mijn Levenspad persoonsgegevens verwerken zoals naam, adres, woonplaats, e-mailadres, telefoonnummer en overige contactgegevens. Daarnaast kan Mijn Levenspad accountgegevens, inloggegevens, betaalgegevens, factuurgegevens, bestelgegevens, gegevens over aangekochte credits, gegevens over boekingen en uitgevoerde sessies, gegevens over afgenomen content, communicatie met support en overige gegevens verwerken die nodig zijn voor de uitvoering van de dienstverlening of de bedrijfsvoering.</p>
    <p className="mb-4">Van coaches kan Mijn Levenspad daarnaast profielgegevens verwerken, zoals profielteksten, profielfoto’s, gegevens over expertise, beschikbaarheid en andere gegevens die de coach via het platform zichtbaar maakt of aan Mijn Levenspad verstrekt in verband met toelating tot of gebruik van het platform.</p>
    <p className="mb-4">Voor zover het platform daarin voorziet, kan Mijn Levenspad tevens chatgesprekken, audio, video, verslagen of andere sessiegerelateerde gegevens verwerken. Voor zover dergelijke gegevens worden verwerkt, gebeurt dat uitsluitend voor zover dat noodzakelijk is voor de technische facilitering van het platform, de beschikbaarstelling van de betreffende functionaliteit, support, beveiliging, geschilafhandeling of een andere duidelijk omschreven verwerkingsdoelstelling.</p>
    <p className="mb-4">Mijn Levenspad beoogt niet om zonder noodzaak bijzondere categorieën van persoonsgegevens te verwerken. Gebruikers worden verzocht geen bijzondere persoonsgegevens of andere gevoelige gegevens te delen, tenzij dat voor het gebruik van het platform of de betreffende dienstverlening noodzakelijk is. Voor zover dergelijke gegevens toch worden verwerkt, gebeurt dat uitsluitend indien en voor zover daarvoor een rechtsgeldige grondslag bestaat.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Doeleinden en grondslagen van de verwerking</h2>
    <p className="mb-4">Mijn Levenspad verwerkt persoonsgegevens voor het aanmaken en beheren van accounts, het registreren van gebruikers, het mogelijk maken van toegang tot het platform, het faciliteren van boekingen van sessies, het verwerken van credits, het beschikbaar stellen van content, het verwerken en leveren van bestellingen, het afwikkelen van betalingen en het administreren van uitbetalingen aan coaches. Deze verwerkingen zijn noodzakelijk voor de uitvoering van de overeenkomst of voor het nemen van precontractuele maatregelen op verzoek van de betrokkene.</p>
    <p className="mb-4">Mijn Levenspad verwerkt persoonsgegevens daarnaast voor haar administratie, facturatie, financiële afwikkeling, dossieropbouw en het voldoen aan wettelijke verplichtingen, waaronder fiscale en administratieve bewaarplichten. Deze verwerkingen zijn noodzakelijk om te voldoen aan een wettelijke verplichting en, voor zover dat daarnaast relevant is, voor het gerechtvaardigde belang van een ordelijke bedrijfsvoering.</p>
    <p className="mb-4">Verder verwerkt Mijn Levenspad persoonsgegevens voor het technisch functioneren, beveiligen, onderhouden en verbeteren van het platform, voor het verlenen van support, voor het behandelen van klachten en geschillen, voor het voorkomen van misbruik, fraude en onbevoegd gebruik en voor het beschermen van de rechten en belangen van Mijn Levenspad, haar gebruikers en derden. Deze verwerkingen zijn gebaseerd op het gerechtvaardigde belang van Mijn Levenspad bij een veilig, goed functionerend en betrouwbaar platform.</p>
    <p className="mb-4">Indien Mijn Levenspad een nieuwsbrief of andere elektronische marketingcommunicatie verzendt, worden persoonsgegevens daarvoor uitsluitend verwerkt voor zover daarvoor een toereikende wettelijke grondslag bestaat. Voor zover wettelijk vereist zal Mijn Levenspad daarvoor voorafgaande toestemming vragen. Indien de verwerking is gebaseerd op toestemming, kan die toestemming te allen tijde worden ingetrokken. Indien direct marketing plaatsvindt op basis van een andere toegestane grondslag, heeft de betrokkene te allen tijde het recht daartegen bezwaar te maken.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Rol van Mijn Levenspad en van coaches</h2>
    <p className="mb-4">Mijn Levenspad treedt ten aanzien van sessies op als faciliterend, technisch en organisatorisch platform. Voor de persoonsgegevens die Mijn Levenspad verwerkt in verband met accounts, boekingen, betaalafwikkeling, technische infrastructuur, support, beveiliging en eventuele opslag of beschikbaarstelling van sessiegerelateerde gegevens, treedt Mijn Levenspad op als verwerkingsverantwoordelijke.</p>
    <p className="mb-4">De coach is zelf verantwoordelijk voor de persoonsgegevens die hij of zij zelfstandig verwerkt in het kader van de inhoudelijke uitvoering van de sessie en de eigen beroeps- of bedrijfsuitoefening. Voor zover een coach in dat kader zelfstandig de doeleinden en middelen van de verwerking bepaalt, is die coach daarvoor zelf verwerkingsverantwoordelijke.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Met wie persoonsgegevens kunnen worden gedeeld</h2>
    <p className="mb-4">Mijn Levenspad deelt persoonsgegevens uitsluitend voor zover dat nodig is voor de uitvoering van haar dienstverlening, voor haar bedrijfsvoering, om te voldoen aan een wettelijke verplichting of indien daarvoor een andere geldige grondslag bestaat.</p>
    <p className="mb-4">Persoonsgegevens kunnen in dat verband worden gedeeld met aanbieders van hosting- en platformdiensten, leveranciers van software of technische ondersteuning, betaaldienstverleners, aanbieders van communicatiediensten zoals e-mailproviders, aanbieders van cloud- of documentopslag, de boekhouder of andere administratieve ondersteuners en, voor zover sprake is van productverkoop en levering, met vervoerders, bezorgdiensten of andere logistieke partijen die betrokken zijn bij de aflevering van producten. Voor zover derden persoonsgegevens in opdracht van Mijn Levenspad verwerken, sluit Mijn Levenspad waar wettelijk vereist een verwerkersovereenkomst.</p>
    <p className="mb-4">Voor zover cliënten en coaches via het platform met elkaar in contact treden of sessies met elkaar aangaan, kunnen persoonsgegevens van cliënten en coaches onderling zichtbaar of uitwisselbaar zijn voor zover dat uit de aard van het platform en de dienstverlening voortvloeit.</p>
    <p className="mb-4">Persoonsgegevens kunnen daarnaast worden verstrekt aan toezichthouders, overheidsinstanties of andere derden indien Mijn Levenspad daartoe wettelijk verplicht is of indien dat noodzakelijk is voor de bescherming van haar rechten of belangen.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Doorgifte buiten de Europese Economische Ruimte</h2>
    <p className="mb-4">Indien Mijn Levenspad gebruik maakt van dienstverleners die persoonsgegevens verwerken buiten de Europese Economische Ruimte, of indien persoonsgegevens anderszins buiten de Europese Economische Ruimte worden doorgegeven, zal Mijn Levenspad erop toezien dat die doorgifte uitsluitend plaatsvindt met inachtneming van de daarvoor geldende wettelijke vereisten.</p>
    <p className="mb-4">Dat betekent dat doorgifte in voorkomend geval slechts zal plaatsvinden indien sprake is van een passend beschermingsniveau op grond van een adequaatheidsbesluit van de Europese Commissie, of indien andere passende waarborgen worden toegepast, zoals door de Europese Commissie goedgekeurde standaardcontractbepalingen, dan wel voor zover een andere wettelijk toegestane doorgiftegrond van toepassing is.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Bewaartermijnen</h2>
    <p className="mb-4">Mijn Levenspad bewaart persoonsgegevens niet langer dan noodzakelijk is voor de doeleinden waarvoor zij zijn verzameld of worden gebruikt, tenzij een wettelijke verplichting tot langere bewaring bestaat.</p>
    <p className="mb-4">Accountgegevens en gegevens die samenhangen met het gebruik van het platform worden in beginsel bewaard zolang het account actief is en daarna zolang dat noodzakelijk is voor de afwikkeling van de rechtsverhouding, het behandelen van vragen of geschillen, het beschermen van de rechtspositie van Mijn Levenspad en het voldoen aan wettelijke bewaarplichten.</p>
    <p className="mb-4">Facturen, betaalgegevens en andere administratieve bescheiden worden bewaard zolang dat op grond van fiscale of andere wettelijke verplichtingen noodzakelijk is.</p>
    <p className="mb-4">Communicatie met support, e-mailcorrespondentie, contractstukken en andere dossierstukken worden bewaard zolang dat noodzakelijk is voor de behandeling van de betreffende kwestie, voor de administratie, voor bewijsdoeleinden of voor de behartiging van de rechtspositie van Mijn Levenspad.</p>
    <p className="mb-4">Chats, audio, video, verslagen en andere sessiegerelateerde gegevens worden niet langer bewaard dan noodzakelijk is voor het doel waarvoor zij worden verwerkt, de technische inrichting van het platform, de ondersteuning van gebruikers en eventuele wettelijke of gerechtvaardigde noodzaak om gegevens tijdelijk beschikbaar te houden. Indien dergelijke gegevens slechts tijdelijk beschikbaar worden gesteld via het account, kan Mijn Levenspad de bewaartermijn en wijze van beschikbaarstelling nader bepalen binnen de grenzen van de wet en deze privacyverklaring.</p>
    <p className="mb-4">Gegevens die worden verwerkt voor nieuwsbrief- of marketingdoeleinden worden bewaard zolang de betrokkene daarvoor ingeschreven blijft, zolang een gegeven toestemming voortduurt of zolang het gebruik van die gegevens anderszins rechtmatig is.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Cookies en vergelijkbare technieken</h2>
    <p className="mb-4">Mijn Levenspad kan binnen het platform gebruik maken van cookies en vergelijkbare technieken. Voor zover deze technieken strikt noodzakelijk zijn voor het technisch functioneren van het platform, kunnen zij zonder voorafgaande toestemming worden gebruikt. Voor zover cookies of vergelijkbare technieken worden gebruikt voor analytische, marketing- of andere niet strikt noodzakelijke doeleinden, zal Mijn Levenspad daarvoor, voor zover wettelijk vereist, vooraf toestemming vragen.</p>
    <p className="mb-4">Via cookies en vergelijkbare technieken kunnen onder meer IP-adres, browsergegevens, apparaatgegevens en gegevens over het gebruik van het platform worden verwerkt. Voor zover Mijn Levenspad dergelijke technieken gebruikt, kan zij hierover nadere informatie verstrekken in een afzonderlijke cookieverklaring of via een cookiebanner.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Beveiliging</h2>
    <p className="mb-4">Mijn Levenspad treft passende technische en organisatorische maatregelen om persoonsgegevens te beveiligen tegen verlies en tegen enige vorm van onrechtmatige verwerking. Daarbij houdt Mijn Levenspad rekening met de stand van de techniek, de aard van de verwerkingen en de daarmee samenhangende risico’s.</p>
    <p className="mb-4">Mijn Levenspad maakt in ieder geval gebruik van toegangsbeveiliging, wachtwoordbescherming en organisatorische maatregelen om de toegang tot persoonsgegevens te beperken tot personen voor wie die toegang noodzakelijk is. Voor zover externe dienstverleners worden ingezet, verwacht Mijn Levenspad eveneens dat zij passende beveiligingsmaatregelen treffen.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Verplichte verstrekking van persoonsgegevens</h2>
    <p className="mb-4">Het verstrekken van persoonsgegevens die noodzakelijk zijn voor het voorbereiden, aangaan en uitvoeren van een overeenkomst is een voorwaarde om gebruik te kunnen maken van de relevante diensten van Mijn Levenspad. Indien dergelijke gegevens niet worden verstrekt, kan Mijn Levenspad mogelijk geen account aanmaken, geen sessie faciliteren, geen betaling verwerken, geen content beschikbaar stellen, geen product leveren of de dienstverlening anderszins niet of niet volledig uitvoeren.</p>
    <p className="mb-4">Voor zover persoonsgegevens uitsluitend worden verwerkt op basis van toestemming, is het verstrekken daarvan niet verplicht.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Geautomatiseerde besluitvorming</h2>
    <p className="mb-4">Mijn Levenspad neemt geen besluiten die uitsluitend zijn gebaseerd op geautomatiseerde verwerking en die rechtsgevolgen hebben voor betrokkenen of hen anderszins in aanmerkelijke mate treffen, tenzij dit uitdrukkelijk is toegestaan op grond van de toepasselijke wetgeving en aan de daarvoor geldende voorwaarden is voldaan.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Rechten van betrokkenen</h2>
    <p className="mb-4">Betrokkenen hebben, voor zover de wet daarin voorziet, het recht op inzage in hun persoonsgegevens, het recht op rectificatie van onjuiste persoonsgegevens, het recht op gegevenswissing, het recht op beperking van de verwerking, het recht op overdraagbaarheid van gegevens en het recht om bezwaar te maken tegen verwerkingen die zijn gebaseerd op een gerechtvaardigd belang.</p>
    <p className="mb-4">Voor zover de verwerking is gebaseerd op toestemming, heeft de betrokkene het recht om die toestemming te allen tijde in te trekken. Een intrekking van toestemming laat de rechtmatigheid van de verwerking voorafgaand aan die intrekking onverlet.</p>
    <p className="mb-4">Een verzoek met betrekking tot de uitoefening van deze rechten kan worden gericht aan Mijn Levenspad via de contactgegevens zoals vermeld op het platform. Mijn Levenspad kan aanvullende informatie vragen om de identiteit van de verzoeker vast te stellen alvorens op het verzoek te beslissen.</p>
    <p className="mb-4">Voor zover Mijn Levenspad persoonsgegevens verwerkt voor direct marketing, heeft de betrokkene te allen tijde het recht daartegen bezwaar te maken. In dat geval zal Mijn Levenspad die verwerking voor dat doel beëindigen.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Klachten</h2>
    <p className="mb-4">Indien een betrokkene meent dat Mijn Levenspad persoonsgegevens verwerkt in strijd met de AVG of andere privacywetgeving, kan hij of zij daarover contact opnemen met Mijn Levenspad. Daarnaast heeft iedere betrokkene het recht een klacht in te dienen bij de Autoriteit Persoonsgegevens.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Wijzigingen</h2>
    <p className="mb-4">Mijn Levenspad kan deze privacyverklaring van tijd tot tijd wijzigen. De meest actuele versie wordt via het platform beschikbaar gesteld.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Contact</h2>
    <p className="mb-4">Voor vragen of verzoeken met betrekking tot deze privacyverklaring of de verwerking van persoonsgegevens kan contact worden opgenomen met Mijn Levenspad via de contactgegevens op het platform.</p>
  </>
);

const PrivacyPolicyEN = () => (
  <>
    <h2 className="text-xl font-semibold mt-8 mb-4">Introduction</h2>
    <p className="mb-4">Mijn Levenspad, part of Purush Besakih, located at Waldorpstraat 1594, 2521 CZ The Hague and registered in the Trade Register under Chamber of Commerce number 82878692, processes personal data of visitors and users of its platform, including clients and coaches, as well as other persons with whom there is contact in the context of the services. Mijn Levenspad values the careful handling of personal data and processes this data in accordance with the General Data Protection Regulation (GDPR) and other applicable laws and regulations.</p>
    <p className="mb-4">This privacy statement applies to all processing of personal data by Mijn Levenspad in connection with the use of www.mijnlevenspad.com and the possible mobile application (hereinafter: the platform), creating and using accounts, facilitating sessions between clients and coaches, offering content, selling and delivering products, processing payments, maintaining contact with users, and sending potential newsletters or other marketing communications.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Data Controller</h2>
    <p className="mb-4">The data controller for the processing of personal data is Mijn Levenspad, part of Purush Besakih, located at Waldorpstraat 1594, 2521 CZ The Hague, registered in the Trade Register under Chamber of Commerce number 82878692. For questions about this privacy statement or the processing of personal data, contact can be made with Mijn Levenspad via the contact details on the platform.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Whose Personal Data is Processed</h2>
    <p className="mb-4">Mijn Levenspad processes personal data of clients, coaches, visitors to the platform, persons who create or wish to create an account, persons who book or provide a session, persons who purchase content, persons who order products, persons who contact Mijn Levenspad, and other persons whose personal data is received in the context of the services or business operations.</p>
    <p className="mb-4">If a client or coach provides personal data of another person to Mijn Levenspad, Mijn Levenspad assumes that this person is authorized to provide this data and has adequately informed the data subject concerned.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">How Personal Data is Obtained</h2>
    <p className="mb-4">Mijn Levenspad generally obtains personal data directly from the data subject themselves, for example when a client or coach creates an account, fills in profile data, books or offers a session, purchases credits, buys content, orders a product, makes contact, makes a payment, or otherwise uses the platform.</p>
    <p className="mb-4">In addition, Mijn Levenspad may obtain personal data that arises from the use of the platform, such as log data, technical usage data, and cookie data, insofar as these are used.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Which Personal Data is Processed</h2>
    <p className="mb-4">Depending on the nature of the contact and the services, Mijn Levenspad may process personal data such as name, address, place of residence, email address, telephone number, and other contact details. In addition, Mijn Levenspad may process account data, login data, payment data, invoice data, order data, data regarding purchased credits, data about bookings and executed sessions, data about purchased content, communication with support, and other data necessary for the execution of the services or business operations.</p>
    <p className="mb-4">For coaches, Mijn Levenspad may additionally process profile data, such as profile texts, profile pictures, data about expertise, availability, and other data that the coach makes visible via the platform or provides to Mijn Levenspad in connection with admission to or use of the platform.</p>
    <p className="mb-4">Insofar as the platform provides for this, Mijn Levenspad may also process chat conversations, audio, video, reports, or other session-related data. Insofar as such data is processed, this is done exclusively to the extent necessary for the technical facilitation of the platform, the provision of the relevant functionality, support, security, dispute resolution, or another clearly defined processing objective.</p>
    <p className="mb-4">Mijn Levenspad does not intend to process special categories of personal data without necessity. Users are requested not to share special personal data or other sensitive data, unless this is necessary for the use of the platform or the relevant services. Insofar as such data is nevertheless processed, this is only done if and to the extent that there is a valid legal basis for this.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Purposes and Legal Grounds for Processing</h2>
    <p className="mb-4">Mijn Levenspad processes personal data for creating and managing accounts, registering users, enabling access to the platform, facilitating bookings of sessions, processing credits, making content available, processing and delivering orders, processing payments, and administering payouts to coaches. These processing operations are necessary for the execution of the agreement or for taking pre-contractual measures at the request of the data subject.</p>
    <p className="mb-4">Mijn Levenspad also processes personal data for its administration, invoicing, financial settlement, file building, and compliance with legal obligations, including tax and administrative retention obligations. These processing operations are necessary to comply with a legal obligation and, insofar as relevant additionally, for the legitimate interest of orderly business operations.</p>
    <p className="mb-4">Furthermore, Mijn Levenspad processes personal data for the technical functioning, securing, maintaining, and improving of the platform, for providing support, for handling complaints and disputes, for preventing abuse, fraud, and unauthorized use, and for protecting the rights and interests of Mijn Levenspad, its users, and third parties. These processing operations are based on the legitimate interest of Mijn Levenspad in a safe, well-functioning, and reliable platform.</p>
    <p className="mb-4">If Mijn Levenspad sends a newsletter or other electronic marketing communication, personal data for this purpose is exclusively processed insofar as there is a sufficient legal basis for this. Where legally required, Mijn Levenspad will request prior consent. If the processing is based on consent, that consent can be withdrawn at any time. If direct marketing takes place on the basis of another permitted ground, the data subject has the right to object to this at any time.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Role of Mijn Levenspad and Coaches</h2>
    <p className="mb-4">With regard to sessions, Mijn Levenspad acts as a facilitating, technical, and organizational platform. For the personal data that Mijn Levenspad processes in connection with accounts, bookings, payment processing, technical infrastructure, support, security, and possible storage or availability of session-related data, Mijn Levenspad acts as the data controller.</p>
    <p className="mb-4">The coach is personally responsible for the personal data that he or she independently processes in the context of the substantive execution of the session and their own professional or business practice. Insofar as a coach independently determines the purposes and means of processing in that context, that coach is the data controller for this.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">With Whom Personal Data may be Shared</h2>
    <p className="mb-4">Mijn Levenspad shares personal data exclusively insofar as this is necessary for the execution of its services, for its business operations, to comply with a legal obligation, or if there is another valid basis for this.</p>
    <p className="mb-4">Personal data can in that context be shared with providers of hosting and platform services, suppliers of software or technical support, payment service providers, providers of communication services such as email providers, providers of cloud or document storage, the bookkeeper or other administrative supporters and, insofar as product sales and delivery are involved, with carriers, delivery services, or other logistical parties involved in the delivery of products. Insofar as third parties process personal data on behalf of Mijn Levenspad, Mijn Levenspad concludes a data processing agreement where legally required.</p>
    <p className="mb-4">Insofar as clients and coaches contact each other via the platform or enter into sessions with each other, personal data of clients and coaches may be mutually visible or exchangeable insofar as this flows from the nature of the platform and the services.</p>
    <p className="mb-4">Personal data may additionally be provided to supervisors, government authorities, or other third parties if Mijn Levenspad is legally obliged to do so or if this is necessary for the protection of its rights or interests.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Transfer outside the European Economic Area</h2>
    <p className="mb-4">If Mijn Levenspad uses service providers that process personal data outside the European Economic Area, or if personal data is otherwise transferred outside the European Economic Area, Mijn Levenspad will ensure that this transfer only takes place in compliance with the applicable legal requirements.</p>
    <p className="mb-4">This means that a transfer will only take place, if applicable, if there is an adequate level of protection based on an adequacy decision of the European Commission, or if other appropriate safeguards are applied, such as standard contractual clauses approved by the European Commission, or insofar as another legally permitted transfer ground applies.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Retention Periods</h2>
    <p className="mb-4">Mijn Levenspad does not retain personal data longer than necessary for the purposes for which they were collected or are used, unless there is a legal obligation for longer retention.</p>
    <p className="mb-4">Account data and data related to the use of the platform are in principle retained for as long as the account is active and thereafter for as long as necessary for the settlement of the legal relationship, handling questions or disputes, protecting the legal position of Mijn Levenspad, and complying with legal retention obligations.</p>
    <p className="mb-4">Invoices, payment details, and other administrative documents are retained as long as necessary on the basis of tax or other legal obligations.</p>
    <p className="mb-4">Communication with support, email correspondence, contract documents, and other file documents are retained as long as necessary for the handling of the relevant matter, for administration, for evidence purposes, or for safeguarding the legal position of Mijn Levenspad.</p>
    <p className="mb-4">Chats, audio, video, reports, and other session-related data are not retained longer than necessary for the purpose for which they are processed, the technical setup of the platform, the support of users, and any legal or legitimate need to keep data temporarily available. If such data is only temporarily made available via the account, Mijn Levenspad can further determine the retention period and method of availability within the limits of the law and this privacy statement.</p>
    <p className="mb-4">Data processed for newsletter or marketing purposes are retained as long as the data subject remains subscribed for this, as long as a given consent continues, or as long as the use of that data is otherwise lawful.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Cookies and Similar Technologies</h2>
    <p className="mb-4">Mijn Levenspad may use cookies and similar technologies within the platform. Insofar as these technologies are strictly necessary for the technical functioning of the platform, they can be used without prior consent. Insofar as cookies or similar technologies are used for analytical, marketing, or other non-strictly necessary purposes, Mijn Levenspad will, where legally required, request prior consent for this.</p>
    <p className="mb-4">Through cookies and similar technologies, IP address, browser data, device data, and data about the use of the platform, among other things, can be processed. Insofar as Mijn Levenspad uses such technologies, it may provide further information about this in a separate cookie statement or via a cookie banner.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Security</h2>
    <p className="mb-4">Mijn Levenspad takes appropriate technical and organizational measures to secure personal data against loss and against any form of unlawful processing. In doing so, Mijn Levenspad takes into account the state of the art, the nature of the processing, and the associated risks.</p>
    <p className="mb-4">Mijn Levenspad in any case uses access security, password protection, and organizational measures to limit access to personal data to persons for whom that access is necessary. Insofar as external service providers are deployed, Mijn Levenspad also expects them to take appropriate security measures.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Mandatory Provision of Personal Data</h2>
    <p className="mb-4">Providing personal data necessary for preparing, entering into, and executing an agreement is a condition for using the relevant services of Mijn Levenspad. If such data is not provided, Mijn Levenspad may not be able to create an account, facilitate a session, process a payment, make content available, deliver a product, or otherwise not or not fully perform the services.</p>
    <p className="mb-4">Insofar as personal data is processed exclusively on the basis of consent, its provision is not mandatory.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Automated Decision Making</h2>
    <p className="mb-4">Mijn Levenspad does not make decisions based solely on automated processing that have legal effects concerning data subjects or similarly significantly affect them, unless this is explicitly permitted under the applicable legislation and the conditions applicable thereto are met.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Rights of Data Subjects</h2>
    <p className="mb-4">Data subjects have, insofar as the law provides for this, the right to access their personal data, the right to rectification of incorrect personal data, the right to erasure of data, the right to restriction of processing, the right to data portability, and the right to object to processing based on a legitimate interest.</p>
    <p className="mb-4">Insofar as the processing is based on consent, the data subject has the right to withdraw that consent at any time. A withdrawal of consent does not affect the lawfulness of the processing prior to that withdrawal.</p>
    <p className="mb-4">A request relating to the exercise of these rights can be directed to Mijn Levenspad via the contact details as stated on the platform. Mijn Levenspad may request additional information to establish the identity of the requester before deciding on the request.</p>
    <p className="mb-4">Insofar as Mijn Levenspad processes personal data for direct marketing, the data subject has the right to object to this at any time. In that case, Mijn Levenspad will terminate that processing for that purpose.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Complaints</h2>
    <p className="mb-4">If a data subject believes that Mijn Levenspad is processing personal data in violation of the GDPR or other privacy legislation, he or she can contact Mijn Levenspad about this. In addition, every data subject has the right to lodge a complaint with the Data Protection Authority.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Changes</h2>
    <p className="mb-4">Mijn Levenspad may amend this privacy statement from time to time. The most current version is made available via the platform.</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Contact</h2>
    <p className="mb-4">For questions or requests regarding this privacy statement or the processing of personal data, contact can be made with Mijn Levenspad via the contact details on the platform.</p>
  </>
);

const PrivacyPolicyZH = () => (
  <>
    <h2 className="text-xl font-semibold mt-8 mb-4">引言</h2>
    <p className="mb-4">Mijn Levenspad（Purush Besakih 旗下）位于 Waldorpstraat 1594, 2521 CZ The Hague，商会注册号为 82878692。我们会处理平台访客和用户（包括来访者与教练）以及与服务相关的其他联系人的个人数据。我们依据 GDPR 及适用法律法规审慎处理个人数据。</p>
    <p className="mb-4">本隐私政策适用于以下相关的个人数据处理：使用 www.mijnlevenspad.com 和可能的移动应用、账户创建与使用、来访者与教练会话撮合、内容提供、产品销售与交付、支付处理、用户沟通以及新闻简报/营销沟通。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">数据控制者</h2>
    <p className="mb-4">数据控制者为 Mijn Levenspad（Purush Besakih 旗下），地址 Waldorpstraat 1594, 2521 CZ The Hague，商会注册号 82878692。如对本政策或数据处理有疑问，请通过平台联系方式与我们联系。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">处理对象</h2>
    <p className="mb-4">我们可能处理来访者、教练、平台访客、注册用户、预约或提供会话者、购买内容/产品者、联系平台者，以及在服务/运营中涉及的其他人员的个人数据。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">数据来源</h2>
    <p className="mb-4">数据通常由数据主体直接提供，例如注册、完善资料、预约/提供会话、购买积分、下单、支付或使用平台时；我们也可能通过平台使用行为获得日志、技术使用数据及 Cookie 数据。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">处理的数据类型</h2>
    <p className="mb-4">可能包含姓名、地址、邮箱、电话等联系信息，以及账户、登录、支付、发票、订单、积分、预约与会话、内容购买、客服沟通等为服务与运营所需的数据。对教练还可能处理公开资料、头像、专长与可用时间等数据。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">处理目的与法律依据</h2>
    <p className="mb-4">我们处理数据用于账户管理、提供平台访问、会话预约、积分与支付处理、内容与订单交付、教练结算、客服、安全、反欺诈、争议处理及平台改进。法律依据包括合同履行、法定义务、同意和合法利益。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">与教练的角色划分</h2>
    <p className="mb-4">Mijn Levenspad 对平台基础设施、账户、预约、支付、支持与安全相关处理承担数据控制者角色。教练对其在会话专业服务中独立决定目的和方式的数据处理负责。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">数据共享对象</h2>
    <p className="mb-4">仅在必要范围内共享，包括托管与平台服务商、技术供应商、支付服务商、通信服务商、云存储、行政支持及物流合作方；在法律要求时也会向监管或政府机构提供。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">跨境传输</h2>
    <p className="mb-4">若数据传输至欧洲经济区外，我们会依据适用法律采取保障措施，如欧盟充分性决定、标准合同条款或其他合法机制。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">保存期限</h2>
    <p className="mb-4">个人数据仅在达成处理目的所需期限内保存，除非法律要求更长。不同类型数据（账户、支付、客服、会话记录、营销数据）按各自法律与业务需要保存并在必要时删除或匿名化。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">Cookie 与类似技术</h2>
    <p className="mb-4">我们可能使用 Cookie 与类似技术。严格必要的技术可在无需同意下使用；分析或营销等非必要用途会在法律要求下先征得同意。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">安全措施</h2>
    <p className="mb-4">我们采取合理的技术与组织措施保护数据，包括访问控制、密码保护和最小权限原则，并要求外部服务商采取相应安全措施。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">是否必须提供数据</h2>
    <p className="mb-4">某些数据是注册、预约、支付和交付服务所必需。若不提供，可能无法创建账户、完成会话或使用相关功能。基于同意处理的数据可自愿提供。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">自动化决策</h2>
    <p className="mb-4">除非法律明确允许并满足条件，我们不会仅基于自动化处理作出对个人产生法律或类似重大影响的决定。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">数据主体权利</h2>
    <p className="mb-4">在法律规定范围内，您享有访问、更正、删除、限制处理、数据可携带与反对处理等权利；如处理基于同意，您可随时撤回同意，且不影响撤回前处理的合法性。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">投诉</h2>
    <p className="mb-4">若您认为我们违反 GDPR 或其他隐私法规处理数据，可先联系 Mijn Levenspad；您也有权向数据保护监管机构投诉。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">政策更新</h2>
    <p className="mb-4">我们可能不时更新本隐私政策，最新版本将通过平台发布。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">联系我们</h2>
    <p className="mb-4">如对本隐私政策或个人数据处理有任何问题或请求，请通过平台上的联系方式联系 Mijn Levenspad。</p>
  </>
);

const PrivacyPolicyPage = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ui = legalUiCopy[language];
  const hasLocalizedBody = language === "en" || language === "nl" || language === "zh";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="relative mx-auto max-w-4xl flex-1 container px-6 pb-16 pt-32 md:pt-40">
        <div className="sticky top-28 z-30 mb-6 bg-background/95 py-2 backdrop-blur-sm md:top-32 lg:top-36">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
            {ui.back}
          </Button>
        </div>
        <h1 className="mb-4 text-3xl font-bold">{ui.title}</h1>
        {!hasLocalizedBody && (
          <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-md text-sm">
            {ui.fallback}
          </div>
        )}
        <div className="prose prose-slate dark:prose-invert max-w-none" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {language === "nl" ? <PrivacyPolicyNL /> : language === "zh" ? <PrivacyPolicyZH /> : <PrivacyPolicyEN />}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PrivacyPolicyPage;
