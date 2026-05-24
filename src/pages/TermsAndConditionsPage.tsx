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
    title: "Terms and Conditions",
    fallback: "Note: This document is currently provided in English for your selected language.",
  },
  fr: {
    back: "Retour",
    title: "Conditions generales",
    fallback: "Remarque : ce document est actuellement disponible en anglais pour la langue selectionnee.",
  },
  nl: {
    back: "Terug",
    title: "Algemene voorwaarden",
    fallback: "Let op: dit document is momenteel in het Engels beschikbaar voor de gekozen taal.",
  },
  ar: {
    back: "رجوع",
    title: "الشروط والاحكام",
    fallback: "ملاحظة: هذا المستند متاح حاليا باللغة الانجليزية للغة التي اخترتها.",
  },
  zh: {
    back: "返回",
    title: "条款和条件",
    fallback: "说明：当前所选语言仅提供英文版本。",
  },
  ru: {
    back: "Назад",
    title: "Условия и положения",
    fallback: "Примечание: для выбранного языка этот документ пока доступен только на английском.",
  },
  es: {
    back: "Volver",
    title: "Terminos y condiciones",
    fallback: "Nota: este documento esta disponible actualmente en ingles para el idioma seleccionado.",
  },
};

const TermsNL = () => (
  <>
    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 1. | DEFINITIES</h2>
    <p className="mb-4">In deze algemene voorwaarden worden de volgende termen, steeds met hoofdletter beginnend, in de navolgende betekenis gebruikt.</p>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li><strong>Mijn Levenspad:</strong> de gebruiker van deze algemene voorwaarden, onderdeel van Purush Besakih, gevestigd aan Waldorpstraat 1594, 2521 CZ te ’s-Gravenhage, ingeschreven in het Handelsregister onder KvK-nummer 82878692.</li>
      <li><strong>Cliënt:</strong> iedere natuurlijke persoon, niet handelend voor doeleinden die binnen zijn beroeps- of bedrijfsactiviteiten vallen, die van het Platform gebruik maakt of beoogt te maken voor het volgen van Sessies, toegang tot Content, de aanschaf van Credits en/of de aanschaf van Producten.</li>
      <li><strong>Coach:</strong> iedere natuurlijke persoon of rechtspersoon, althans handelend voor doeleinden die binnen zijn beroeps- of bedrijfsactiviteiten vallen, die via het Platform Sessies aanbiedt en verzorgt of beoogt aan te bieden en te verzorgen.</li>
      <li><strong>Wederpartij:</strong> iedere natuurlijke of rechtspersoon met wie Mijn Levenspad een Overeenkomst heeft gesloten of beoogt te sluiten, waaronder zowel een Cliënt als Coach begrepen kunnen zijn.</li>
      <li><strong>Overeenkomst met Mijn Levenspad:</strong> iedere overeenkomst tussen enerzijds Mijn Levenspad en anderzijds een Cliënt of Coach. Overeenkomsten met Mijn Levenspad en Cliënten kunnen betreffen: 1) overeenkomsten betreffende het gebruik van het Platform, 2) de aanschaf van Producten, 3) de aanschaf van Credits en 4) de toegang tot Content. De Overeenkomst met Mijn Levenspad en Coaches betreft de overeenkomst in het kader waarvan Mijn Levenspad zich tegenover de Coach verbindt tot het door de Coach mogen aanbieden van Sessies op het Platform.</li>
      <li><strong>Overeenkomst tussen Cliënt en Coach:</strong> iedere overeenkomst tussen enerzijds een Cliënt en anderzijds een Coach betreffende het verzorgen van een Sessie. Mijn Levenspad is bij deze Overeenkomst geen partij.</li>
      <li><strong>Overeenkomst:</strong> afhankelijk van de context: de Overeenkomst met Mijn Levenspad dan wel de Overeenkomst tussen Cliënt en Coach.</li>
      <li><strong>Platform:</strong> www.mijnlevenspad.com, alsook de eventuele mobiele applicatie van Mijn Levenspad.</li>
      <li><strong>Sessie:</strong> iedere door een Coach in opdracht van een Cliënt te verzorgen live-chat, coachingssessie, consult of andere bijeenkomst (al dan niet op afstand), waaronder mede begrepen sessies per chat, videogesprek of telefonisch contact. Het aanmelden door een Cliënt voor een Sessie geschiedt op basis van een Overeenkomst tussen de Cliënt en Coach, bij welke Overeenkomst Mijn Levenspad dan ook geen partij is.</li>
      <li><strong>Content:</strong> content waartoe de Cliënt tegen afzonderlijke betaling toegang verkrijgt middels het Platform in het kader van een Overeenkomst met Mijn Levenspad, bijvoorbeeld in de vorm van een online training, cursus of e-learning.</li>
      <li><strong>Credits:</strong> het via het Platform door een Cliënt aangeschafte tegoed waarmee Sessies kunnen worden afgenomen en dat, indien en voor zover Mijn Levenspad dat mogelijk maakt, ook voor andere op het Platform aangeduide doeleinden kan worden gebruikt.</li>
      <li><strong>Producten:</strong> de in het kader van een Overeenkomst met Mijn Levenspad door Mijn Levenspad aan een Cliënt te verkopen en te leveren zaken.</li>
      <li><strong>Account:</strong> de persoonlijke toegangsomgeving van een Cliënt of Coach op het Platform.</li>
      <li><strong>Schriftelijk:</strong> communicatie op schrift, communicatie per e-mail of enige andere wijze van communicatie die met het oog op de stand der techniek en de in het maatschappelijk verkeer geldende opvattingen hiermee gelijk kan worden gesteld.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 2. | ALGEMENE BEPALINGEN</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Deze algemene voorwaarden zijn van toepassing op elk aanbod van Mijn Levenspad, iedere Overeenkomst met Mijn Levenspad en alle daaruit tussen Mijn Levenspad en de Wederpartij voortvloeiende rechtsverhoudingen.</li>
      <li>Deze algemene voorwaarden zijn mede van toepassing op het gebruik van het Platform door Cliënten en Coaches, ook indien nog geen betaalde dienst of betaald product is afgenomen.</li>
      <li>Deze algemene voorwaarden zijn tevens van toepassing op de wijze waarop via het Platform een Overeenkomst tussen Cliënt en Coach tot stand komt, alsmede op het gebruik van het Platform in verband met die Overeenkomst tussen Cliënt en Coach, doch niet op de inhoudelijke uitvoering van de Sessie zelf. Mijn Levenspad treedt ter zake van Sessies uitsluitend op als faciliterend, technisch en organisatorisch platform en is geen partij bij de Overeenkomst tussen Cliënt en Coach.</li>
      <li>De Overeenkomst tussen Cliënt en Coach betreft uitsluitend de door de Coach ten behoeve van de Cliënt te verzorgen Sessie. Alle verplichtingen die betrekking hebben op de inhoud, wijze van begeleiding, advisering en verdere uitvoering van de Sessie rusten uitsluitend op de Coach en de Cliënt.</li>
      <li>De Overeenkomst met Mijn Levenspad en de Overeenkomst tussen Cliënt en Coach zijn van elkaar te onderscheiden rechtsverhoudingen. Het eindigen, vernietigen, ontbinden of anderszins wegvallen van de ene Overeenkomst brengt niet zonder meer het eindigen, vernietigen, ontbinden of anderszins wegvallen van de andere Overeenkomst mee, tenzij uit de aard of strekking van de betreffende bepaling anders voortvloeit.</li>
      <li>Voor zover een bepaling in deze algemene voorwaarden naar haar aard uitsluitend betrekking heeft op de Overeenkomst met Mijn Levenspad, geldt zij niet voor de Overeenkomst tussen Cliënt en Coach. Voor zover een bepaling naar haar aard uitsluitend betrekking heeft op de Overeenkomst tussen Cliënt en Coach, geldt zij niet voor de Overeenkomst met Mijn Levenspad.</li>
      <li>De eventuele algemene voorwaarden van de Wederpartij zijn niet van toepassing.</li>
      <li>Van het bepaalde in deze algemene voorwaarden kan uitsluitend uitdrukkelijk en Schriftelijk worden afgeweken.</li>
      <li>Vernietiging of nietigheid van een of meer van de bepalingen uit deze algemene voorwaarden of een Overeenkomst als zodanig laat de geldigheid van de overige bedingen onverlet. In een voorkomend geval zijn partijen verplicht in onderling overleg te treden teneinde een vervangende regeling te treffen ten aanzien van het aangetaste beding. Daarbij wordt zoveel mogelijk het doel en de strekking van de oorspronkelijke bepaling in acht genomen.</li>
      <li>Mijn Levenspad is gerechtigd haar rechten en verplichtingen uit een Overeenkomst met Mijn Levenspad over te dragen aan een derde, bijvoorbeeld in geval van wijziging van haar rechtsvorm.</li>
      <li>Indien deze algemene voorwaarden beschikbaar zijn in meer dan één taal, is de Nederlandstalige versie bepalend voor de uitleg van de inhoud en strekking daarvan.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 3. | TOTSTANDKOMING VAN DE OVEREENKOMST</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Elk aanbod van Mijn Levenspad is vrijblijvend, ook indien daarin een termijn voor aanvaarding is vermeld.</li>
      <li>Kennelijke fouten en vergissingen in een aanbod van Mijn Levenspad, op het Platform of in een andere mededeling van Mijn Levenspad, binden Mijn Levenspad niet.</li>
      <li>Een Overeenkomst met Mijn Levenspad komt, onverminderd het overige in deze algemene voorwaarden bepaalde, tot stand op het moment dat het aanbod van Mijn Levenspad door de betreffende Wederpartij op de daartoe door Mijn Levenspad aangewezen wijze is aanvaard en aan alle daarbij gestelde voorwaarden is voldaan.</li>
      <li>Een Overeenkomst tussen Cliënt en Coach komt tot stand op het moment dat de Cliënt via het Platform een Sessie bij een Coach boekt of anderszins afneemt op de daartoe door Mijn Levenspad beschikbaar gestelde wijze en aan de voorwaarden voor die afname is voldaan.</li>
      <li>Voor het afnemen van een Sessie, het aanschaffen van Credits, het verkrijgen van toegang tot Content en het plaatsen van een bestelling van Producten is steeds een Account vereist.</li>
      <li>Mijn Levenspad is nimmer gehouden een Overeenkomst met een Wederpartij aan te gaan en is gerechtigd een registratie, aanvraag, bestelling of verzoek tot aansluiting zonder opgave van redenen te weigeren, in het bijzonder indien Mijn Levenspad redelijke grond heeft te twijfelen aan de juistheid of volledigheid van de door de Wederpartij verstrekte gegevens, aan de geschiktheid van de betreffende Coach voor toelating tot het Platform of aan de mogelijkheid van behoorlijke nakoming van de Overeenkomst.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 4. | ACCOUNT EN GEBRUIK VAN HET PLATFORM</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Iedere Wederpartij die een Account aanmaakt, staat ervoor in dat de door haar in verband met de registratie en het gebruik van het Platform verstrekte gegevens juist en volledig zijn. De Wederpartij is gehouden wijzigingen in deze gegevens zo spoedig mogelijk via het Account of op een andere door Mijn Levenspad aangegeven wijze door te geven.</li>
      <li>De Wederpartij dient de toegangsgegevens van haar Account strikt geheim te houden en alle redelijke maatregelen te nemen om onbevoegde toegang tot het Account te voorkomen.</li>
      <li>Iedere handeling die via een Account wordt verricht, wordt geacht te zijn verricht door de betreffende Wederpartij. Mijn Levenspad mag daarop afgaan, tenzij de betreffende Wederpartij tijdig Schriftelijk heeft gemeld dat sprake is van onbevoegd gebruik en die melding, gelet op de omstandigheden van het geval, voldoende aannemelijk is.</li>
      <li>Het is de Wederpartij niet toegestaan haar Account over te dragen, aan derden ter beschikking te stellen of door derden te laten gebruiken.</li>
      <li>Indien de Wederpartij vermoedt of weet dat haar Account onbevoegd wordt gebruikt, is zij verplicht Mijn Levenspad daarvan onverwijld in kennis te stellen en voorts al hetgeen te doen dat redelijkerwijs nodig is om verdere schade of misbruik te voorkomen of te beperken.</li>
      <li>Mijn Levenspad is gerechtigd een Account tijdelijk of permanent te blokkeren, op te schorten of te beëindigen indien de Wederpartij handelt in strijd met de Overeenkomst (waaronder deze algemene voorwaarden mede begrepen), de wet, de openbare orde, de goede zeden of de redelijke belangen van Mijn Levenspad, andere gebruikers van het Platform of derden.</li>
      <li>Mijn Levenspad is gerechtigd het Platform, de structuur daarvan, de daarop beschikbare functionaliteiten en de wijze waarop gebruik kan worden gemaakt van het Platform van tijd tot tijd te wijzigen. De Wederpartij kan ter zake nimmer aanspraak maken op blijvende beschikbaarheid van een specifieke functionaliteit.</li>
      <li>Mijn Levenspad spant zich in voor een naar behoren functionerend en toegankelijk Platform, maar kan niet garanderen dat het Platform te allen tijde zonder onderbreking, storingen of gebreken beschikbaar is.</li>
      <li>Mijn Levenspad is gerechtigd onderhoud, updates, beveiligingsmaatregelen en technische aanpassingen uit te voeren, ook indien dit tijdelijk gevolgen heeft voor de beschikbaarheid van het Platform, een Account of bepaalde functionaliteiten.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 5. | GEBRUIK VAN HET PLATFORM EN ROL VAN MIJN LEVENSPAD</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Mijn Levenspad stelt middels het Platform aan Cliënten en Coaches een digitale omgeving ter beschikking voor registratie, profielpresentatie, het aankopen en gebruiken van Credits, het aanbieden en afnemen van Sessies, het aanbieden van Content door Mijn Levenspad en, indien en voor zover van toepassing, het aanbieden en afnemen van Producten.</li>
      <li>Mijn Levenspad treedt met betrekking tot Sessies uitsluitend op als faciliterend, technisch en organisatorisch platform. Zij biedt de digitale infrastructuur aan waarmee een Cliënt een Coach kan selecteren en via het Platform een Sessie met die Coach kan afnemen.</li>
      <li>Mijn Levenspad is geen partij bij de Overeenkomst tussen Cliënt en Coach en is niet verantwoordelijk voor de inhoud, uitvoering, kwaliteit, uitkomst of verdere afwikkeling van een Sessie.</li>
      <li>De keuze van een Cliënt voor een bepaalde Coach geschiedt op basis van eigen inzicht en verantwoordelijkheid van de Cliënt. De Cliënt is zelf verantwoordelijk voor zijn keuze om met een bepaalde Coach een Overeenkomst tussen Cliënt en Coach aan te gaan.</li>
      <li>Profielinformatie, omschrijvingen van expertise, beschikbaarheid en overige informatie met betrekking tot een Coach kunnen door of namens de betreffende Coach op het Platform worden geplaatst. Mijn Levenspad mag voor de juistheid en volledigheid van deze informatie afgaan op de door de Coach verstrekte gegevens en staat niet in voor de inhoudelijke juistheid daarvan. Tarieven voor Sessies richting Cliënten worden evenwel door Mijn Levenspad vastgesteld en via het Platform gecommuniceerd.</li>
      <li>Voor zover een Cliënt via het Platform Credits gebruikt ten behoeve van een Sessie, ziet de rol van Mijn Levenspad mede op de technische en administratieve verwerking daarvan. Dat laat onverlet dat de Overeenkomst tussen Cliënt en Coach betrekking heeft op de inhoudelijke dienstverlening van de Coach.</li>
      <li>Mijn Levenspad is gerechtigd bij het functioneren van het Platform, de beschikbaarstelling van Content, de ondersteuning van gebruikers en andere platformfunctionaliteiten gebruik te maken van geautomatiseerde systemen en AI-ondersteunde toepassingen.</li>
      <li>Mijn Levenspad is gerechtigd de inrichting en werking van het Platform, de wijze waarop Sessies worden gefaciliteerd, de toegang tot Content, de aankoop en inzet van Credits en de wijze van presentatie van Producten en Coaches van tijd tot tijd aan te passen.</li>
      <li>Het is de Wederpartij niet toegestaan het Platform te gebruiken op een wijze die de werking, veiligheid, integriteit of reputatie van het Platform of van Mijn Levenspad kan schaden.</li>
      <li>Indien een Wederpartij handelt in strijd met dit artikel of anderszins misbruik maakt van het Platform, is Mijn Levenspad gerechtigd passende maatregelen te nemen, waaronder mede begrepen waarschuwing, opschorting van toegang, blokkering van functionaliteiten en beëindiging van het Account of de betreffende Overeenkomst.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 6. | HERROEPINGSRECHT</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Het bepaalde in dit artikel is uitsluitend van toepassing op Overeenkomsten waarbij een Cliënt partij is en waaruit voor de Cliënt een betalingsverplichting voortvloeit.</li>
      <li>Behoudens het bepaalde in het overige van dit artikel en met name het bepaalde in lid 3, kan de Cliënt een Overeenkomst tot 14 dagen zonder opgave van redenen herroepen. In geval van een Overeenkomst betreffende een Sessie, Credits of de beschikbaarstelling van Content vangt de bedenktijd aan op de dag van totstandkoming van de Overeenkomst. In geval van een Overeenkomst betreffende de levering van Producten vangt de bedenktijd aan op de dag dat de Producten door of namens de Cliënt in ontvangst zijn genomen.</li>
      <li>De Cliënt heeft geen herroepingsrecht bij:
        <ul className="list-[lower-alpha] pl-6 mt-2 space-y-1">
          <li>een Overeenkomst betreffende een Sessie, na volledige uitvoering van die Sessie, indien:
            <ul className="list-disc pl-6 mt-1">
              <li>de nakoming is begonnen met uitdrukkelijke voorafgaande instemming van de Cliënt; en</li>
              <li>de Cliënt heeft verklaard afstand te doen van zijn herroepingsrecht zodra de Overeenkomst volledig is nagekomen;</li>
            </ul>
          </li>
          <li>een Overeenkomst betreffende de beschikbaarstelling van Content die onmiddellijk na totstandkoming van de Overeenkomst volledig beschikbaar wordt gesteld, indien:
            <ul className="list-disc pl-6 mt-1">
              <li>de nakoming is begonnen met uitdrukkelijke voorafgaande instemming van de Cliënt; en</li>
              <li>de Cliënt heeft verklaard afstand te doen van zijn herroepingsrecht zodra de Content beschikbaar is gesteld;</li>
            </ul>
          </li>
          <li>een Overeenkomst ten aanzien waarvan het herroepingsrecht op andere gronden volgens Afdeling 6.5.2B van het Burgerlijk Wetboek is uitgesloten dan wel geen toepassing vindt. Indien daarvan in toekomstige gevallen sprake is, zal de betreffende uitsluitingsgrond uitdrukkelijk in het aanbod worden vermeld.</li>
        </ul>
      </li>
      <li>Uitvoering van een Sessie binnen de bedenktijd van 14 dagen, beschikbaarstelling van Content binnen de bedenktijd van 14 dagen en het binnen deze bedenktijd kunnen verzilveren van Credits geschieden slechts op uitdrukkelijk verzoek van de Cliënt.</li>
      <li>Indien Content gefaseerd wordt aangeboden of anderszins niet onmiddellijk volledig beschikbaar wordt gesteld, geldt dat het herroepingsrecht binnen de wettelijke termijn in beginsel blijft bestaan voor zover de Content op het moment van herroeping nog niet volledig beschikbaar is gesteld.</li>
      <li>Indien Credits na aanschaf op het Account van de Cliënt worden bijgeschreven, geldt die bijschrijving op zichzelf niet als volledige nakoming van de Overeenkomst. Zolang en voor zover de betreffende Credits nog niet door de Cliënt zijn verzilverd voor een Sessie of een andere door Mijn Levenspad aangewezen prestatie, blijft het herroepingsrecht binnen de wettelijke termijn bestaan.</li>
      <li>Herroeping van een Overeenkomst betreffende Credits ziet uitsluitend op het ten tijde van de herroeping nog niet verzilverde saldo. Voor zover Credits binnen de bedenktijd geheel of gedeeltelijk zijn verzilverd, geldt het herroepingsrecht niet met betrekking tot het reeds verzilverde deel, althans is de Cliënt in zoverre een evenredige vergoeding verschuldigd.</li>
      <li>De Cliënt kan de Overeenkomst herroepen door daartoe per e-mail een verzoek in te dienen bij Mijn Levenspad of door gebruikmaking van het door Mijn Levenspad aangeboden modelformulier voor herroeping. Herroeping van een Overeenkomst tussen Cliënt en Coach geschiedt eveneens via Mijn Levenspad, aangezien zij de totstandkoming en betalingsafwikkeling via het Platform faciliteert. Zo spoedig mogelijk nadat Mijn Levenspad in kennis is gesteld van het voornemen van de Cliënt om de Overeenkomst te herroepen en indien is voldaan aan de voorwaarden van dit artikel, zal zij de herroeping per e-mail aan de Cliënt bevestigen.</li>
      <li>In geval van geleverde Producten dient de Cliënt gedurende de bedenktijd zorgvuldig om te gaan met de betreffende Producten en de verpakkingen daarvan. De Cliënt mag de te retourneren Producten slechts in die mate hanteren en inspecteren voor zover nodig is om de aard en kenmerken van de Producten te beoordelen. Het uitgangspunt hierbij is dat de Cliënt de Producten slechts mag hanteren en inspecteren zoals hij dat in een fysieke winkel zou mogen doen.</li>
      <li>Indien de Cliënt van het herroepingsrecht gebruik maakt, zal hij de betreffende Producten onbeschadigd, met alle geleverde toebehoren en in de originele staat en verpakking aan Mijn Levenspad terugleveren overeenkomstig de door haar verstrekte redelijke retourinstructies.</li>
      <li>De Cliënt is aansprakelijk voor de eventuele waardevermindering van geretourneerde Producten die het gevolg is van een manier van omgaan met de Producten die verder gaat dan is toegestaan ingevolge lid 9. Mijn Levenspad is gerechtigd deze waardevermindering aan de Cliënt in rekening te brengen, al dan niet door deze te verrekenen met de eventueel van de Cliënt reeds ontvangen betaling.</li>
      <li>Bij uitoefening van het herroepingsrecht betreffende een Sessie die binnen de bedenktijd deels is uitgevoerd, betreffende Credits voor zover deze reeds gedeeltelijk zijn verzilverd, of betreffende Content die op het moment van herroeping reeds gedeeltelijk beschikbaar is gesteld, na een verzoek overeenkomstig het bepaalde in lid 4, is de Cliënt een bedrag verschuldigd dat evenredig is aan dat gedeelte van de Overeenkomst dat op het moment van uitoefening van het herroepingsrecht reeds is nagekomen.</li>
      <li>Teruglevering van Producten dient plaats te vinden binnen 14 dagen nadat de Cliënt de Overeenkomst conform het bepaalde in lid 8 heeft herroepen.</li>
      <li>De kosten van retournering van Producten komen voor rekening van de Cliënt.</li>
      <li>Mijn Levenspad zal de eventueel reeds van de Cliënt ontvangen betaling, minus de eventuele waardevermindering en de eventuele kosten als bedoeld in lid 12, zo spoedig mogelijk, doch uiterlijk binnen 14 dagen na herroeping van de Overeenkomst aan de Cliënt terugbetalen, mits de eventueel terug te leveren Producten door Mijn Levenspad zijn terugontvangen, dan wel door de Cliënt is aangetoond dat de Producten daadwerkelijk retour zijn gezonden. Voor zover de herroeping betrekking heeft op een Overeenkomst tussen Cliënt en Coach, geschiedt terugbetaling door Mijn Levenspad.</li>
      <li>Indien slechts ten aanzien van een gedeelte van de bestelling van Producten het herroepingsrecht wordt uitgeoefend, komen de eventuele bezorgkosten die door de Cliënt in eerste instantie zijn betaald niet voor restitutie of kwijtschelding in aanmerking.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 7. | PRIJZEN, CREDITS EN BETALINGEN DOOR CLIËNTEN</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>De tarieven die gelden voor het afnemen van Sessies, de aanschaf van Credits, de beschikbaarstelling van Content en de levering van Producten worden door Mijn Levenspad vastgesteld en via het Platform gecommuniceerd.</li>
      <li>Voor het afnemen van een Sessie dient de Cliënt op de door Mijn Levenspad voorgeschreven wijze te betalen. Betaling kan onder meer geschieden door middel van Credits, een pakket of een andere via het Platform aangeboden betaalwijze. De wijze waarop voor een Sessie kan worden betaald, wordt door Mijn Levenspad op het Platform vermeld.</li>
      <li>Indien en voor zover voor een Sessie gebruik wordt gemaakt van Credits, worden het aantal Credits, de waarde daarvan en de wijze waarop Credits kunnen worden gebruikt door Mijn Levenspad op het Platform vermeld.</li>
      <li>Credits worden na aanschaf bijgeschreven op het Account van de Cliënt.</li>
      <li>Tijdens een lopende Sessie kan de Cliënt, indien en voor zover het Platform daarin voorziet en de Coach daartoe bereid is, aanvullende Credits aanschaffen teneinde de Sessie te verlengen. Indien onvoldoende saldo beschikbaar is en geen tijdige verlenging plaatsvindt, eindigt de Sessie van rechtswege zodra het beschikbare tegoed is verbruikt of de betaalde sessieduur is verstreken.</li>
      <li>Tenzij uitdrukkelijk anders is vermeld, zijn Credits persoonsgebonden, niet overdraagbaar en niet inwisselbaar voor geld.</li>
      <li>Mijn Levenspad is gerechtigd per transactie transactiekosten in rekening te brengen. Deze worden voorafgaand aan het sluiten van de betreffende Overeenkomst uitdrukkelijk vermeld.</li>
      <li>Betaling door de Cliënt dient te geschieden op de daartoe door Mijn Levenspad aangewezen wijze, waaronder mede begrepen betaling via een door haar ingeschakelde betaaldienstverlener.</li>
      <li>Een betaling geldt eerst als ontvangen op het moment dat het betreffende bedrag daadwerkelijk door Mijn Levenspad of de door haar ingeschakelde betaaldienstverlener is ontvangen en geautoriseerd.</li>
      <li>Indien een betaling wordt geweigerd, gestorneerd of teruggedraaid, is Mijn Levenspad gerechtigd de uitvoering van de betreffende Overeenkomst op te schorten, de toegang tot het Platform of onderdelen daarvan te blokkeren, Credits niet bij te schrijven of reeds bijgeschreven Credits te corrigeren, een Sessie niet aan te laten vangen of voort te laten zetten, en toegang tot Content of levering van Producten op te schorten, onverminderd haar overige rechten.</li>
      <li>Mijn Levenspad is gerechtigd facturen en andere betalingsmededelingen uitsluitend langs elektronische weg aan de Wederpartij ter beschikking te stellen.</li>
      <li>Indien de Wederpartij niet tijdig aan haar betalingsverplichting voldoet, treedt het verzuim in ten aanzien van een Wederpartij die Cliënt is eerst in nadat Mijn Levenspad haar Schriftelijk heeft aangemaand tot betaling binnen een termijn van veertien dagen na de dag van ontvangst van die aanmaning, onder vermelding van de gevolgen van het uitblijven van betaling, en betaling binnen die termijn uitblijft. Ten aanzien van een Wederpartij die niet als Cliënt handelt, treedt het verzuim van rechtswege in op het moment dat de toepasselijke betalingstermijn is verstreken.</li>
      <li>Vanaf de dag dat het verzuim van de Wederpartij intreedt, is de Wederpartij over het openstaande bedrag de dan geldende wettelijke rente verschuldigd, met dien verstande dat ten aanzien van een Wederpartij die niet als Cliënt handelt de wettelijke handelsrente verschuldigd is.</li>
      <li>Alle redelijke kosten, zoals gerechtelijke, buitengerechtelijke en executiekosten, gemaakt ter verkrijging van de door de Wederpartij verschuldigde bedragen, komen voor rekening van de Wederpartij.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 8. | CONTENT</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Mijn Levenspad is gerechtigd de aard, inhoud, omvang, opbouw en wijze van beschikbaarstelling van Content nader te bepalen. Content kan onder meer bestaan uit online trainingen, cursussen, e-learning, documentatie, lesmateriaal en andere digitale inhoud.</li>
      <li>De Cliënt verkrijgt uitsluitend een persoonlijk, beperkt, herroepelijk, niet-exclusief en niet-overdraagbaar gebruiksrecht ten aanzien van de Content, uitsluitend voor eigen gebruik en binnen de grenzen van de Overeenkomst met Mijn Levenspad.</li>
      <li>Mijn Levenspad is gerechtigd Content van tijd tot tijd technisch, inhoudelijk of functioneel aan te passen, te actualiseren of te wijzigen, mits de aard en het wezenlijke doel van de betreffende Content daardoor niet wezenlijk worden aangetast.</li>
      <li>De Cliënt is zelf verantwoordelijk voor de apparatuur, programmatuur, internetverbinding en overige voorzieningen die nodig zijn om van de Content gebruik te kunnen maken.</li>
      <li>Het is de Cliënt niet toegestaan Content of delen daarvan te kopiëren, reproduceren, downloaden anders dan voor zover een functie van het Platform daarin voorziet, openbaar te maken, aan derden ter beschikking te stellen, te verspreiden, te verkopen of anderszins te gebruiken op een wijze die buiten de grenzen van de Overeenkomst met Mijn Levenspad valt.</li>
      <li>De Cliënt dient klachten over Content binnen bekwame tijd nadat hij een gebrek heeft ontdekt aan Mijn Levenspad kenbaar te maken.</li>
      <li>Het bepaalde in dit artikel laat de dwingendrechtelijke rechten van de Cliënt met betrekking tot het beantwoorden van de Content aan de Overeenkomst onverlet.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 9. | PRODUCTEN</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Het aanbod van Producten geldt zolang de voorraad strekt. Indien een Product na totstandkoming van de Overeenkomst niet of niet tijdig leverbaar blijkt, is Mijn Levenspad gerechtigd de Overeenkomst voor zover die op dat Product betrekking heeft te ontbinden. In dat geval heeft de Cliënt uitsluitend aanspraak op terugbetaling van het voor het betreffende Product betaalde bedrag.</li>
      <li>Levering van Producten geschiedt op het door de Cliënt opgegeven afleveradres.</li>
      <li>De door Mijn Levenspad opgegeven of met de Cliënt overeengekomen leveringstermijnen zijn indicatieve, niet-fatale termijnen. Het verzuim van Mijn Levenspad treedt niet eerder in dan nadat de Cliënt haar Schriftelijk in gebreke heeft gesteld, in welke ingebrekestelling een redelijke termijn voor nakoming is vermeld, en Mijn Levenspad na het verstrijken van die termijn nog steeds met de nakoming in gebreke is.</li>
      <li>Indien Mijn Levenspad voor de levering van Producten afhankelijk is van door derden te verrichten prestaties, is zij niet aansprakelijk voor vertragingen die het gevolg zijn van omstandigheden die in redelijkheid niet aan haar kunnen worden toegerekend.</li>
      <li>Het risico van verlies en beschadiging van Producten gaat over op de Cliënt op het moment van feitelijke ontvangst door de Cliënt of een door haar aangewezen derde, die niet de vervoerder is.</li>
      <li>Indien de Cliënt meent dat een geleverd Product niet aan de Overeenkomst beantwoordt, dient zij dit binnen bekwame tijd nadat zij dat heeft ontdekt of redelijkerwijs had behoren te ontdekken aan Mijn Levenspad te melden. Klachten met betrekking tot non-conformiteit dienen binnen bekwame tijd na ontdekking aan Mijn Levenspad te worden gemeld, waarbij een termijn van twee maanden na ontdekking in elk geval als tijdig wordt aangemerkt.</li>
      <li>Het bepaalde in de vorige leden laat de dwingendrechtelijke rechten van de Cliënt met betrekking tot conformiteit onverlet. Een Product dient aan de Overeenkomst te beantwoorden en de Cliënt behoudt de wettelijke rechten die hem in dat verband toekomen.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 10. | GEBRUIK VAN HET PLATFORM, VERPLICHTINGEN EN GEDRAGSREGELS</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>De Wederpartij is gehouden het Platform te gebruiken in overeenstemming met deze algemene voorwaarden en de toepasselijke wet- en regelgeving.</li>
      <li>De Wederpartij dient zich bij het gebruik van het Platform en in het contact met Mijn Levenspad, andere gebruikers van het Platform en overige betrokkenen respectvol, zorgvuldig en verantwoord te gedragen.</li>
      <li>Het is de Wederpartij niet toegestaan het Platform te gebruiken op een wijze die hinder, schade, storing, misbruik of veiligheidsrisico’s voor Mijn Levenspad, andere gebruikers of derden veroorzaakt of kan veroorzaken.</li>
      <li>Het is de Wederpartij niet toegestaan via het Platform beledigende, discriminerende, bedreigende, intimiderende, seksueel grensoverschrijdende, misleidende of anderszins ongepaste uitingen te doen of gedragingen te vertonen.</li>
      <li>Het is de Wederpartij niet toegestaan onjuiste, onvolledige of misleidende informatie te verstrekken aan Mijn Levenspad of, voor zover van toepassing, aan een andere gebruiker van het Platform.</li>
      <li>Indien de Cliënt deelneemt aan een Sessie, is hij gehouden tijdig beschikbaar te zijn en de voor de Sessie benodigde medewerking te verlenen. Indien de Cliënt niet tijdig beschikbaar is of anderszins onvoldoende medewerking verleent, komen de gevolgen daarvan voor zijn rekening en risico.</li>
      <li>De Coach is gehouden Sessies op zorgvuldige, respectvolle en professionele wijze uit te voeren, met inachtneming van de aard van de via het Platform aangeboden dienstverlening en de redelijke kwaliteits- en gedragsnormen die Mijn Levenspad in verband met het Platform kenbaar maakt.</li>
      <li>Het is de Coach niet toegestaan tijdens of in verband met een Sessie medische diagnoses te stellen, medicijnen voor te schrijven, medische behandelingen aan te bieden of anderszins medische adviezen te geven.</li>
      <li>De Coach dient zich te onthouden van uitingen of gedragingen die voor Cliënten misleidend, ongepast, grensoverschrijdend of anderszins onzorgvuldig zijn, daaronder mede begrepen het wekken van onrealistische verwachtingen omtrent de uitkomst of werking van een Sessie.</li>
      <li>De Wederpartij begrijpt en aanvaardt dat de via het Platform aangeboden Sessies en de door Mijn Levenspad beschikbaar gestelde Content een spiritueel, coachend of begeleidend karakter kunnen hebben en niet zijn aan te merken als medische, psychiatrische, psychologische of andere vorm van gereguleerde zorg.</li>
      <li>Het Platform, de via het Platform aangeboden Sessies en de door Mijn Levenspad beschikbaar gestelde Content zijn niet bedoeld voor spoedeisende hulp, crisissituaties of acute medische of psychische problematiek, waaronder mede begrepen suïcidaliteit, ernstige depressieve klachten of andere situaties waarin onmiddellijke professionele hulpverlening is aangewezen. In dergelijke gevallen dient de betrokken persoon zich te wenden tot een arts, hulpverlener, alarmdienst of andere daarvoor geëigende instantie.</li>
      <li>Indien een Wederpartij handelt in strijd met het bepaalde in dit artikel, is Mijn Levenspad gerechtigd passende maatregelen te nemen, waaronder mede begrepen het geven van aanwijzingen, het beperken van functionaliteiten, het opschorten van toegang tot het Platform of onderdelen daarvan en het beëindigen van het Account of de betreffende Overeenkomst, onverminderd haar overige rechten.</li>
      <li>Indien de Cliënt klachten heeft over de inhoudelijke uitvoering van een Sessie, dient hij deze zo spoedig mogelijk kenbaar te maken aan de betreffende Coach. Mijn Levenspad kan daarbij desgewenst faciliteren in de communicatie of afwikkeling, maar is voor de inhoudelijke uitvoering van de Sessie niet verantwoordelijk.</li>
      <li>Indien een Sessie geen doorgang vindt, wordt onderbroken of voortijdig eindigt als gevolg van niet of niet tijdig verschijnen van de Cliënt, niet of niet tijdig verschijnen van de Coach, technische storingen of andere omstandigheden rondom de uitvoering van de Sessie, is Mijn Levenspad gerechtigd nadere regels te stellen omtrent de afwikkeling daarvan, waaronder mede begrepen het al dan niet terugboeken van Credits, restitutie of het opnieuw plannen van de Sessie.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 11. | COACHES</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>De Coach verricht zijn werkzaamheden via het Platform uitsluitend in de uitoefening van zijn beroep of bedrijf en op zelfstandige basis.</li>
      <li>Tussen Mijn Levenspad en de Coach bestaat geen arbeidsovereenkomst, geen gezagsverhouding en geen andere rechtsverhouding die kan worden aangemerkt als een dienstbetrekking of daarmee gelijk te stellen verhouding.</li>
      <li>De Coach is zelf verantwoordelijk voor de inhoud, uitvoering en afwikkeling van de door hem verzorgde Sessies, alsmede voor zijn communicatie en gedragingen jegens Cliënten.</li>
      <li>De Coach verricht zijn werkzaamheden voor eigen rekening en risico en is zelf verantwoordelijk voor zijn bedrijfsvoering.</li>
      <li>De Coach is zelf verantwoordelijk voor het voldoen aan alle op hem rustende wettelijke verplichtingen in verband met zijn werkzaamheden via het Platform, waaronder mede begrepen fiscale verplichtingen en, voor zover van toepassing, verplichtingen met betrekking tot registraties, vergunningen en verzekeringen.</li>
      <li>De Coach is zelf verantwoordelijk voor de afdracht van omzetbelasting, inkomstenbelasting en andere belastingen, premies en heffingen die verband houden met zijn werkzaamheden via het Platform, voor zover van toepassing.</li>
      <li>De Coach staat ervoor in dat hij gerechtigd is zijn werkzaamheden via het Platform te verrichten en dat hij beschikt over de kennis, ervaring en overige kwaliteiten die redelijkerwijs van hem mogen worden verwacht in verband met de door hem aangeboden Sessies.</li>
      <li>De Coach is gehouden zijn profielinformatie, zijn omschrijving, zijn expertise en overige door of namens hem op het Platform geplaatste informatie juist, volledig en actueel te houden.</li>
      <li>De Coach is gehouden de door Mijn Levenspad kenbaar gemaakte redelijke kwaliteitsnormen, gedragsregels, technische vereisten en overige voorwaarden voor toelating tot en gebruik van het Platform na te leven, met dien verstande dat deze niet worden geacht een gezagsverhouding in het leven te roepen.</li>
      <li>De Coach is zelf verantwoordelijk voor het beschikken over een deugdelijke internetverbinding, geschikte apparatuur en overige technische voorzieningen die nodig zijn voor het aanbieden en uitvoeren van Sessies via het Platform.</li>
      <li>De Coach is gehouden Sessies op de overeengekomen of via het Platform kenbaar gemaakte momenten zorgvuldig uit te voeren en de daarvoor redelijkerwijs benodigde medewerking te verlenen.</li>
      <li>Indien de Coach tekortschiet in de nakoming van zijn verplichtingen jegens een Cliënt of anderszins onzorgvuldig, onrechtmatig of in strijd met deze algemene voorwaarden handelt, komen de gevolgen daarvan voor zijn eigen rekening en risico.</li>
      <li>De Coach vrijwaart Mijn Levenspad tegen alle aanspraken van Cliënten, overheidsinstanties en overige derden die verband houden met de door hem verzorgde Sessies, zijn fiscale positie, zijn bedrijfsvoering, zijn gedragingen of andere aan hem toe te rekenen omstandigheden.</li>
      <li>De Coach vrijwaart Mijn Levenspad in het bijzonder tegen aanspraken van de Belastingdienst of andere bevoegde instanties ter zake van belastingen, premies, heffingen, boetes, rente of daarmee verband houdende vorderingen die samenhangen met de werkzaamheden van de Coach of de rechtsverhouding tussen Mijn Levenspad en de Coach.</li>
      <li>Indien Mijn Levenspad in verband met een aanspraak als bedoeld in de vorige leden kosten maakt, schade lijdt of tot betaling wordt aangesproken, is de Coach gehouden Mijn Levenspad daarvoor volledig schadeloos te stellen.</li>
      <li>Indien de Coach handelt in strijd met de Overeenkomst met Mijn Levenspad (waaronder het bepaalde in deze algemene voorwaarden mede begrepen), de wet of de redelijke belangen van Mijn Levenspad, Cliënten of het Platform, is Mijn Levenspad gerechtigd passende maatregelen te nemen, waaronder mede begrepen het geven van aanwijzingen, het beperken van functionaliteiten, het opschorten van toegang tot het Platform en het beëindigen van de Overeenkomst met Mijn Levenspad, onverminderd haar overige rechten.</li>
      <li>De Coach is zelf verantwoordelijk voor het beschikken over een beroeps- of bedrijfsaansprakelijkheidsverzekering, indien en voor zover dat gelet op de aard van zijn werkzaamheden redelijkerwijs van hem mag worden verwacht.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 12. | VERGOEDINGEN EN UITBETALINGEN TEN AANZIEN VAN COACHES</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>De Coach is aan Mijn Levenspad de uitdrukkelijk en Schriftelijk tussen partijen overeengekomen maandelijkse vergoeding verschuldigd.</li>
      <li>De door Cliënten voor Sessies betaalde bedragen worden door Mijn Levenspad ontvangen en administratief verwerkt via het Platform en/of de door haar ingeschakelde betaaldienstverlener.</li>
      <li>Tenzij uitdrukkelijk en Schriftelijk anders is overeengekomen, komt aan de Coach uitsluitend aanspraak toe op uitbetaling van het gedeelte van de door de Cliënt voor een Sessie betaalde vergoeding dat resteert na aftrek van btw en transactiekosten.</li>
      <li>Mijn Levenspad is gerechtigd bij de berekening van hetgeen aan de Coach wordt uitbetaald rekening te houden met terugboekingen, correcties, het herroepingsrecht van Cliënten, niet-geïncasseerde bedragen en andere posten die op grond van de rechtsverhouding tussen Mijn Levenspad en de Coach of op grond van de feitelijke betalingsafwikkeling relevant zijn.</li>
      <li>Uitbetaling aan de Coach geschiedt in beginsel maandelijks, tenzij uitdrukkelijk en Schriftelijk anders is overeengekomen of via het Platform een andere uitbetalingsfrequentie is ingesteld.</li>
      <li>Mijn Levenspad is gerechtigd uitbetalingen aan de Coach op te schorten indien en zolang de Coach niet aan zijn verplichtingen jegens Mijn Levenspad voldoet, indien redelijkerwijs twijfel bestaat over de juistheid van de aan de uitbetaling ten grondslag liggende gegevens, indien sprake is van een geschil met een Cliënt, indien een terugbetaling of correctie redelijkerwijs te verwachten is, of indien opschorting anderszins gerechtvaardigd is ter bescherming van Mijn Levenspad of derden.</li>
      <li>Mijn Levenspad is gerechtigd hetgeen zij aan de Coach verschuldigd is te verrekenen met al hetgeen de Coach uit welke hoofde dan ook aan haar verschuldigd is.</li>
      <li>De Coach is gehouden facturen van Mijn Levenspad binnen de daarop vermelde termijn te voldoen. Indien geen specifieke betalingstermijn is vermeld, geldt een betalingstermijn van 14 dagen na factuurdatum.</li>
      <li>Een klacht van de Coach met betrekking tot een factuur, afrekening of uitbetaling dient binnen vijf dagen nadat de Coach daarvan kennis heeft genomen of redelijkerwijs kennis had behoren te nemen Schriftelijk bij Mijn Levenspad te worden ingediend. Een dergelijke klacht schort de betalingsverplichtingen van de Coach niet op, tenzij Mijn Levenspad uitdrukkelijk en Schriftelijk anders bevestigt.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 13. | DUUR, OPZEGGING EN BEËINDIGING TEN AANZIEN VAN COACHES</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>De Overeenkomst met Mijn Levenspad tussen haar en de Coach wordt aangegaan voor onbepaalde tijd, tenzij uitdrukkelijk en Schriftelijk anders is overeengekomen.</li>
      <li>De Coach is gerechtigd de Overeenkomst met Mijn Levenspad op te zeggen met inachtneming van een opzegtermijn van één maand.</li>
      <li>Opzegging door de Coach dient Schriftelijk te geschieden.</li>
      <li>Mijn Levenspad is gerechtigd de Overeenkomst met Mijn Levenspad met de Coach op te zeggen met inachtneming van een opzegtermijn van één maand.</li>
      <li>Mijn Levenspad is gerechtigd de Overeenkomst met Mijn Levenspad met onmiddellijke ingang geheel of gedeeltelijk op te schorten of te beëindigen indien de Coach zijn verplichtingen uit de Overeenkomst, deze algemene voorwaarden of de wet niet, niet tijdig of niet behoorlijk nakomt, tenzij de tekortkoming van de coach deze maatregel redelijkerwijs niet rechtvaardigt.</li>
      <li>Mijn Levenspad is voorts gerechtigd de Overeenkomst met Mijn Levenspad met onmiddellijke ingang geheel of gedeeltelijk op te schorten of te beëindigen indien:
        <ul className="list-[lower-alpha] pl-6 mt-2 space-y-1">
          <li>de Coach in staat van faillissement verkeert, een aanvraag daartoe is ingediend, surseance van betaling heeft aangevraagd, zijn onderneming beëindigt of liquideert, of anderszins niet langer vrijelijk over zijn vermogen kan beschikken;</li>
          <li>op gegronde wijze moet worden gevreesd dat de Coach zijn verplichtingen niet zal kunnen nakomen;</li>
          <li>de Coach onjuiste of misleidende gegevens heeft verstrekt bij zijn toelating tot of gebruik van het Platform;</li>
          <li>de Coach handelt op een wijze die schadelijk is of kan zijn voor de goede naam, werking, veiligheid of betrouwbaarheid van Mijn Levenspad of het Platform;</li>
          <li>de Coach handelt in strijd met de redelijke kwaliteits- en gedragsnormen die voor gebruik van het Platform gelden.</li>
        </ul>
      </li>
      <li>In geval van beëindiging van de Overeenkomst met Mijn Levenspad met de Coach, om welke reden ook, is Mijn Levenspad gerechtigd de toegang van de Coach tot het Platform en zijn Account met onmiddellijke ingang te beëindigen of te beperken.</li>
      <li>Beëindiging van de Overeenkomst met Mijn Levenspad laat reeds vóór het tijdstip van beëindiging ontstane betalingsverplichtingen van de Coach onverlet.</li>
      <li>Bedragen die de Coach op het moment van beëindiging aan Mijn Levenspad verschuldigd is, blijven onverminderd verschuldigd en worden onmiddellijk opeisbaar, tenzij de aard van de betreffende verplichting zich daartegen verzet.</li>
      <li>Mijn Levenspad is na beëindiging van de Overeenkomst met Mijn Levenspad niet gehouden de Coach nog toegang te geven tot het Platform, zijn profiel, zijn Accountgegevens of andere via het Platform beschikbare gegevens of functionaliteiten.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 14. | AANSPRAKELIJKHEID</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Mijn Levenspad treedt ten aanzien van Sessies uitsluitend op als faciliterend, technisch en organisatorisch platform. Zij verbindt zich in het kader van haar dienstverlening uitsluitend tot een inspanningsverplichting en kan nimmer garanderen dat de resultaten worden behaald die de Wederpartij met behulp van het Platform, een Sessie, Content, Credits of Producten beoogt te behalen.</li>
      <li>Voor zover het gebruik van het Platform of de uitvoering van een Overeenkomst met Mijn Levenspad mede afhankelijk is van diensten van derden, staat Mijn Levenspad niet in voor de voortdurende beschikbaarheid of foutloze werking van die diensten. Dit laat haar verplichtingen uit de Overeenkomst met Mijn Levenspad en de toepasselijke wet onverlet.</li>
      <li>Mijn Levenspad is geen partij bij de Overeenkomst tussen Cliënt en Coach en is nimmer aansprakelijk voor de inhoud, wijze van uitvoering, kwaliteit, uitkomst of verdere afwikkeling van een Sessie.</li>
      <li>Mijn Levenspad draagt geen aansprakelijkheid voor schade in verband met of schade die veroorzaakt is door een onjuistheid of onvolledigheid in de door de Wederpartij of de Coach verstrekte informatie, een tekortkoming in de nakoming van de verplichtingen van de Wederpartij of de Coach die uit de wet of de Overeenkomst voortvloeien, dan wel een andere omstandigheid die niet aan Mijn Levenspad kan worden toegerekend.</li>
      <li>Mijn Levenspad is nimmer aansprakelijk voor indirecte schade, waaronder mede begrepen geleden verlies, gederfde winst, gemiste besparingen, schade als gevolg van bedrijfsstagnatie en andere gevolgschade.</li>
      <li>Mocht Mijn Levenspad ondanks het bepaalde in deze algemene voorwaarden aansprakelijk zijn voor enige schade, dan heeft zij te allen tijde het recht deze schade te herstellen. De Wederpartij dient Mijn Levenspad hiertoe in de gelegenheid te stellen, bij gebreke waarvan elke aansprakelijkheid van Mijn Levenspad ter zake vervalt.</li>
      <li>De aansprakelijkheid van Mijn Levenspad is, behoudens opzet en bewuste roekeloosheid harerzijds, beperkt tot ten hoogste de factuurwaarde van de Overeenkomst met Mijn Levenspad, althans tot dat gedeelte van die Overeenkomst waarop de aansprakelijkheid van Mijn Levenspad betrekking heeft.</li>
      <li>In afwijking van de wettelijke verjaringstermijn, bedraagt de verjaringstermijn van alle vorderingen en verweren jegens Mijn Levenspad een jaar. In afwijking van de vorige zin verjaren aan Cliënten toekomende vorderingen en verweren die gegrond zijn op feiten die de stelling zouden rechtvaardigen dat een consumentenkoop niet aan de Overeenkomst beantwoordt, door verloop van twee jaren.</li>
      <li>Rechtsvorderingen en verweren van Cliënten, gegrond op feiten die de stelling zouden rechtvaardigen dat Content niet aan de Overeenkomst beantwoordt, verjaren door verloop van twee jaren na de beschikbaarstelling van de Content, tenzij de Cliënt het gebrek niet kende of behoorde te kennen, in welk geval het bepaalde in het vorige lid van toepassing is.</li>
      <li>In geval van een consumentenkoop strekken de beperkingen uit dit artikel niet verder dan is toegestaan ingevolge artikel 7:24 lid 2 van het Burgerlijk Wetboek.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 15. | INTELLECTUELE EIGENDOM</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Alle intellectuele eigendomsrechten met betrekking tot het Platform, de daarop aanwezige vormgeving, software, teksten, afbeeldingen, merken, logo’s, databestanden, Content en overige materialen berusten uitsluitend bij Mijn Levenspad of haar licentiegevers.</li>
      <li>Behoudens voor zover uit de aard of strekking van de Overeenkomst met Mijn Levenspad anders voortvloeit, verkrijgt de Wederpartij uitsluitend de niet-exclusieve, niet-overdraagbare en herroepelijke gebruiksrechten die uitdrukkelijk uit deze algemene voorwaarden voortvloeien.</li>
      <li>Het is de Wederpartij niet toegestaan de in lid 1 bedoelde goederen of delen daarvan te verveelvoudigen, openbaar te maken, te reproduceren, te bewerken, te decompileren, door te verkopen, aan derden ter beschikking te stellen of anderszins te gebruiken op een wijze die buiten de grenzen van de Overeenkomst met Mijn Levenspad valt, tenzij Mijn Levenspad daarvoor uitdrukkelijk en Schriftelijk toestemming heeft verleend.</li>
      <li>Voor zover de Wederpartij via het Platform informatie, teksten, afbeeldingen, profielinhoud, beoordelingen, reacties, berichten of andere materialen aan Mijn Levenspad of via het Platform ter beschikking stelt, staat de betreffende Wederpartij ervoor in daartoe gerechtigd te zijn en dat daardoor geen rechten van derden worden geschonden.</li>
      <li>De Wederpartij verleent aan Mijn Levenspad, voor zover nodig voor het gebruik, de werking en de exploitatie van het Platform, een niet-exclusief en voor de duur van de rechtsverhouding met Mijn Levenspad geldend recht om de in het vorige lid bedoelde materialen te gebruiken, te verveelvoudigen, openbaar te maken en anderszins te verwerken, een en ander uitsluitend voor zover dat redelijkerwijs nodig is voor de uitvoering van de Overeenkomst met Mijn Levenspad en de exploitatie van het Platform.</li>
      <li>Indien de Coach profielinformatie, foto’s, omschrijvingen, teksten of andere materialen ten behoeve van zijn presentatie op het Platform aanlevert, is Mijn Levenspad gerechtigd deze materialen te gebruiken in het kader van plaatsing op het Platform en de daarmee samenhangende promotionele uitingen van Mijn Levenspad, tenzij uitdrukkelijk en Schriftelijk anders is overeengekomen.</li>
      <li>Een door Mijn Levenspad geconstateerde of redelijkerwijs vermoede inbreuk op haar intellectuele eigendomsrechten of die van haar licentiegevers geeft haar het recht om zonder voorafgaande aankondiging passende maatregelen te nemen, waaronder mede begrepen verwijdering van Content of andere materialen, blokkering van toegang tot het Platform, opschorting van de Overeenkomst en het vorderen van schadevergoeding.</li>
      <li>De Wederpartij vrijwaart Mijn Levenspad tegen alle aanspraken van derden die zijn gegrond op de stelling dat door de Wederpartij aangeleverde of via haar geplaatste materialen inbreuk maken op rechten van intellectuele eigendom of andere rechten van derden.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTIKEL 16. | SLOTBEPALINGEN</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Op elke Overeenkomst en alle daaruit tussen partijen voortvloeiende rechtsverhoudingen is uitsluitend Nederlands recht van toepassing.</li>
      <li>Alvorens een beroep te doen op de rechter, zijn partijen verplicht zich optimaal in te spannen om geschillen in onderling overleg te beslechten.</li>
      <li>Uitsluitend de bevoegde rechter binnen het arrondissement van de rechtbank Den Haag (Nederland) wordt in eerste aanleg aangewezen om van eventuele gerechtelijke geschillen kennis te nemen, onverminderd het recht van Mijn Levenspad een andere volgens de wet bevoegde rechter aan te wijzen.</li>
      <li>Indien de Wederpartij een Cliënt is, is zij gerechtigd de volgens de wet bevoegde rechter te kiezen binnen een maand nadat Mijn Levenspad Schriftelijk heeft aangekondigd bij de door haar aangewezen rechter te willen procederen.</li>
      <li>Mijn Levenspad is gerechtigd deze algemene voorwaarden te wijzigen. Gewijzigde algemene voorwaarden zijn op reeds bestaande Overeenkomsten van toepassing vanaf 60 dagen nadat zij aan de Wederpartij ter kennis zijn gebracht.</li>
      <li>Indien deze algemene voorwaarden beschikbaar zijn in meer dan één taal, is de Nederlandstalige versie bepalend voor de uitleg van de inhoud en strekking daarvan.</li>
    </ol>
  </>
);

const TermsEN = () => (
  <>
    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 1. | DEFINITIONS</h2>
    <p className="mb-4">In these terms and conditions, the following terms, always capitalized, are used in the following meaning.</p>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li><strong>Mijn Levenspad:</strong> the user of these general terms and conditions, part of Purush Besakih, located at Waldorpstraat 1594, 2521 CZ The Hague, registered in the Trade Register under Chamber of Commerce number 82878692.</li>
      <li><strong>Client:</strong> every natural person, not acting for purposes that fall within their professional or business activities, who uses or intends to use the Platform for following Sessions, access to Content, purchasing Credits, and/or purchasing Products.</li>
      <li><strong>Coach:</strong> every natural or legal person, acting for purposes that fall within their professional or business activities, who offers and provides or intends to offer and provide Sessions via the Platform.</li>
      <li><strong>Counterparty:</strong> every natural or legal person with whom Mijn Levenspad has concluded or intends to conclude an Agreement, which may include both a Client and a Coach.</li>
      <li><strong>Agreement with Mijn Levenspad:</strong> every agreement between Mijn Levenspad on the one hand and a Client or Coach on the other. Agreements with Mijn Levenspad and Clients may concern: 1) agreements regarding the use of the Platform, 2) the purchase of Products, 3) the purchase of Credits, and 4) access to Content. The Agreement with Mijn Levenspad and Coaches concerns the agreement under which Mijn Levenspad commits to allowing the Coach to offer Sessions on the Platform.</li>
      <li><strong>Agreement between Client and Coach:</strong> every agreement between a Client on the one hand and a Coach on the other regarding the provision of a Session. Mijn Levenspad is not a party to this Agreement.</li>
      <li><strong>Agreement:</strong> depending on the context: the Agreement with Mijn Levenspad or the Agreement between Client and Coach.</li>
      <li><strong>Platform:</strong> www.mijnlevenspad.com, as well as any mobile application of Mijn Levenspad.</li>
      <li><strong>Session:</strong> every live chat, coaching session, consultation, or other meeting (whether or not remote) to be provided by a Coach on the instructions of a Client, including sessions via chat, video call, or telephone contact. Registration by a Client for a Session takes place on the basis of an Agreement between the Client and Coach, to which Agreement Mijn Levenspad is therefore not a party.</li>
      <li><strong>Content:</strong> content to which the Client obtains access for a separate fee via the Platform in the context of an Agreement with Mijn Levenspad, for example in the form of an online training, course, or e-learning.</li>
      <li><strong>Credits:</strong> the balance purchased by a Client via the Platform with which Sessions can be purchased and which, if and insofar as Mijn Levenspad makes this possible, can also be used for other purposes indicated on the Platform.</li>
      <li><strong>Products:</strong> the items to be sold and delivered by Mijn Levenspad to a Client in the context of an Agreement with Mijn Levenspad.</li>
      <li><strong>Account:</strong> the personal access environment of a Client or Coach on the Platform.</li>
      <li><strong>In Writing:</strong> communication in writing, communication by e-mail or any other manner of communication that can be equated with this in view of the state of the art and the prevailing views in society.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 2. | GENERAL PROVISIONS</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>These terms and conditions apply to every offer from Mijn Levenspad, every Agreement with Mijn Levenspad, and all legal relationships arising therefrom between Mijn Levenspad and the Counterparty.</li>
      <li>These terms and conditions also apply to the use of the Platform by Clients and Coaches, even if no paid service or paid product has yet been purchased.</li>
      <li>These terms and conditions also apply to the manner in which an Agreement between Client and Coach is concluded via the Platform, as well as to the use of the Platform in connection with that Agreement between Client and Coach, but not to the substantive execution of the Session itself. Mijn Levenspad acts exclusively as a facilitating, technical, and organizational platform with regard to Sessions and is not a party to the Agreement between Client and Coach.</li>
      <li>The Agreement between Client and Coach concerns exclusively the Session to be provided by the Coach for the benefit of the Client. All obligations relating to the content, method of guidance, advice, and further execution of the Session rest exclusively with the Coach and the Client.</li>
      <li>The Agreement with Mijn Levenspad and the Agreement between Client and Coach are distinguishable legal relationships. The ending, annulment, dissolution, or otherwise falling away of one Agreement does not automatically entail the ending, annulment, dissolution, or otherwise falling away of the other Agreement, unless the nature or purport of the relevant provision dictates otherwise.</li>
      <li>Insofar as a provision in these terms and conditions by its nature applies exclusively to the Agreement with Mijn Levenspad, it does not apply to the Agreement between Client and Coach. Insofar as a provision by its nature applies exclusively to the Agreement between Client and Coach, it does not apply to the Agreement with Mijn Levenspad.</li>
      <li>Any general terms and conditions of the Counterparty do not apply.</li>
      <li>Deviations from the provisions of these terms and conditions are only valid if expressly agreed In Writing.</li>
      <li>Annulment or invalidity of one or more provisions of these general terms and conditions or an Agreement as such does not affect the validity of the other provisions. In such a case, the parties are obliged to consult with each other in order to agree on a replacement arrangement for the affected provision, taking into account the purpose and intent of the original provision as much as possible.</li>
      <li>Mijn Levenspad is entitled to transfer its rights and obligations under an Agreement with Mijn Levenspad to a third party, for example in the event of a change in its legal form.</li>
      <li>If these terms and conditions are available in more than one language, the Dutch version is decisive for the interpretation of their content and purport.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 3. | FORMATION OF THE AGREEMENT</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Every offer from Mijn Levenspad is without obligation, even if a period for acceptance is stated therein.</li>
      <li>Obvious errors and mistakes in an offer from Mijn Levenspad, on the Platform, or in another communication from Mijn Levenspad, do not bind Mijn Levenspad.</li>
      <li>An Agreement with Mijn Levenspad is concluded, without prejudice to the other provisions of these terms and conditions, at the moment that the offer of Mijn Levenspad has been accepted by the relevant Counterparty in the manner indicated by Mijn Levenspad and all conditions set for this have been met.</li>
      <li>An Agreement between Client and Coach is concluded at the moment that the Client books or otherwise purchases a Session with a Coach via the Platform in the manner made available for this by Mijn Levenspad and the conditions for that purchase are met.</li>
      <li>An Account is always required for purchasing a Session, purchasing Credits, gaining access to Content, and placing an order for Products.</li>
      <li>Mijn Levenspad is never obliged to enter into an Agreement with a Counterparty and is entitled to refuse a registration, request, order, or request for affiliation without stating reasons, in particular if Mijn Levenspad has reasonable grounds to doubt the accuracy or completeness of the data provided by the Counterparty, the suitability of the relevant Coach for admission to the Platform, or the possibility of proper performance of the Agreement.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 4. | ACCOUNT AND USE OF THE PLATFORM</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Every Counterparty who creates an Account guarantees that the data provided by them in connection with the registration and use of the Platform are accurate and complete. The Counterparty is obliged to report changes to this data as soon as possible via the Account or in another manner indicated by Mijn Levenspad.</li>
      <li>The Counterparty must keep the access details of their Account strictly confidential and take all reasonable measures to prevent unauthorized access to the Account.</li>
      <li>Every action performed via an Account is deemed to have been performed by the relevant Counterparty. Mijn Levenspad may rely on this, unless the relevant Counterparty has reported in a timely manner In Writing that there is unauthorized use and that report, given the circumstances of the case, is sufficiently plausible.</li>
      <li>The Counterparty is not permitted to transfer their Account, make it available to third parties, or have it used by third parties.</li>
      <li>If the Counterparty suspects or knows that their Account is being used unauthorized, they are obliged to inform Mijn Levenspad of this immediately and furthermore to do everything reasonably necessary to prevent or limit further damage or abuse.</li>
      <li>Mijn Levenspad is entitled to temporarily or permanently block, suspend, or terminate an Account if the Counterparty acts contrary to the Agreement (including these terms and conditions), the law, public order, good morals, or the reasonable interests of Mijn Levenspad, other users of the Platform, or third parties.</li>
      <li>Mijn Levenspad is entitled to change the Platform, its structure, the functionalities available on it, and the manner in which the Platform can be used from time to time. The Counterparty can never claim permanent availability of a specific functionality in this regard.</li>
      <li>Mijn Levenspad makes every effort to ensure a properly functioning and accessible Platform, but cannot guarantee that the Platform is available at all times without interruption, disruptions, or defects.</li>
      <li>Mijn Levenspad is entitled to carry out maintenance, updates, security measures, and technical adjustments, even if this temporarily affects the availability of the Platform, an Account, or certain functionalities.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 5. | USE OF THE PLATFORM AND ROLE OF MIJN LEVENSPAD</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Mijn Levenspad makes a digital environment available via the Platform to Clients and Coaches for registration, profile presentation, purchasing and using Credits, offering and purchasing Sessions, offering Content by Mijn Levenspad and, if and insofar as applicable, offering and purchasing Products.</li>
      <li>Mijn Levenspad acts exclusively as a facilitating, technical, and organizational platform with regard to Sessions. It offers the digital infrastructure with which a Client can select a Coach and purchase a Session with that Coach via the Platform.</li>
      <li>Mijn Levenspad is not a party to the Agreement between Client and Coach and is not responsible for the content, execution, quality, outcome, or further handling of a Session.</li>
      <li>The Client's choice of a specific Coach is based on the Client's own insight and responsibility. The Client is personally responsible for their choice to enter into an Agreement between Client and Coach with a specific Coach.</li>
      <li>Profile information, descriptions of expertise, availability, and other information regarding a Coach can be placed on the Platform by or on behalf of the relevant Coach. Mijn Levenspad may rely on the data provided by the Coach for the accuracy and completeness of this information and does not guarantee its substantive accuracy. Rates for Sessions to Clients are, however, determined by Mijn Levenspad and communicated via the Platform.</li>
      <li>Insofar as a Client uses Credits for a Session via the Platform, Mijn Levenspad's role also includes the technical and administrative processing thereof. This does not alter the fact that the Agreement between Client and Coach relates to the substantive services of the Coach.</li>
      <li>Mijn Levenspad is entitled to use automated systems and AI-supported applications in the functioning of the Platform, the availability of Content, user support, and other platform functionalities.</li>
      <li>Mijn Levenspad is entitled to adjust the setup and operation of the Platform, the way in which Sessions are facilitated, access to Content, the purchase and use of Credits, and the presentation of Products and Coaches from time to time.</li>
      <li>The Counterparty is not permitted to use the Platform in a manner that can harm the operation, safety, integrity, or reputation of the Platform or of Mijn Levenspad.</li>
      <li>If a Counterparty acts contrary to this article or otherwise misuses the Platform, Mijn Levenspad is entitled to take appropriate measures, including warning, suspension of access, blocking of functionalities, and termination of the Account or the relevant Agreement.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 6. | RIGHT OF WITHDRAWAL</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>The provisions in this article apply exclusively to Agreements to which a Client is a party and from which a payment obligation arises for the Client.</li>
      <li>Subject to the provisions in the remainder of this article and in particular the provisions in paragraph 3, the Client can withdraw from an Agreement up to 14 days without stating reasons. In the case of an Agreement regarding a Session, Credits, or the provision of Content, the reflection period starts on the day the Agreement is concluded. In the case of an Agreement regarding the delivery of Products, the reflection period starts on the day the Products are received by or on behalf of the Client.</li>
      <li>The Client has no right of withdrawal for:
        <ul className="list-[lower-alpha] pl-6 mt-2 space-y-1">
          <li>an Agreement regarding a Session, after full execution of that Session, if:
            <ul className="list-disc pl-6 mt-1">
              <li>the performance has begun with the explicit prior consent of the Client; and</li>
              <li>the Client has declared to waive their right of withdrawal once the Agreement has been fully performed;</li>
            </ul>
          </li>
          <li>an Agreement regarding the provision of Content that is made fully available immediately after the conclusion of the Agreement, if:
            <ul className="list-disc pl-6 mt-1">
              <li>the performance has begun with the explicit prior consent of the Client; and</li>
              <li>the Client has declared to waive their right of withdrawal once the Content has been made available;</li>
            </ul>
          </li>
          <li>an Agreement in respect of which the right of withdrawal is excluded or does not apply on other grounds under Section 6.5.2B of the Dutch Civil Code. If this occurs in future cases, the relevant exclusion ground will be expressly stated in the offer.</li>
        </ul>
      </li>
      <li>Execution of a Session within the reflection period of 14 days, provision of Content within the reflection period of 14 days, and the ability to redeem Credits within this reflection period only take place at the explicit request of the Client.</li>
      <li>If Content is offered in phases or is otherwise not immediately made fully available, the right of withdrawal generally remains in effect within the statutory period insofar as the Content has not yet been fully made available at the time of withdrawal.</li>
      <li>If Credits are credited to the Client's Account after purchase, that crediting does not in itself count as full performance of the Agreement. As long as and insofar as the relevant Credits have not yet been redeemed by the Client for a Session or another service designated by Mijn Levenspad, the right of withdrawal remains in effect within the statutory period.</li>
      <li>Withdrawal of an Agreement regarding Credits relates exclusively to the balance not yet redeemed at the time of withdrawal. Insofar as Credits have been fully or partially redeemed within the reflection period, the right of withdrawal does not apply to the already redeemed part, or at least the Client owes a proportionate fee to that extent.</li>
      <li>The Client can withdraw the Agreement by submitting a request to Mijn Levenspad by email or by using the model withdrawal form offered by Mijn Levenspad. Withdrawal of an Agreement between Client and Coach is also done via Mijn Levenspad, as it facilitates the conclusion and payment processing via the Platform. As soon as possible after Mijn Levenspad has been informed of the Client's intention to withdraw the Agreement and if the conditions of this article have been met, it will confirm the withdrawal to the Client by email.</li>
      <li>In the case of delivered Products, the Client must handle the relevant Products and their packaging with care during the reflection period. The Client may only handle and inspect the Products to be returned to the extent necessary to assess the nature and characteristics of the Products. The principle here is that the Client may only handle and inspect the Products as they would be allowed to do in a physical store.</li>
      <li>If the Client exercises the right of withdrawal, they will return the relevant Products undamaged, with all supplied accessories and in the original condition and packaging to Mijn Levenspad in accordance with the reasonable return instructions provided by it.</li>
      <li>The Client is liable for any depreciation of returned Products resulting from a way of handling the Products that goes beyond what is permitted under paragraph 9. Mijn Levenspad is entitled to charge this depreciation to the Client, whether or not by offsetting it against any payment already received from the Client.</li>
      <li>Upon exercising the right of withdrawal regarding a Session that has been partially executed within the reflection period, regarding Credits insofar as these have already been partially redeemed, or regarding Content that has already been partially made available at the time of withdrawal, after a request in accordance with paragraph 4, the Client owes an amount proportional to that part of the Agreement that has already been fulfilled at the time the right of withdrawal is exercised.</li>
      <li>Return of Products must take place within 14 days after the Client has withdrawn the Agreement in accordance with paragraph 8.</li>
      <li>The costs of returning Products are for the account of the Client.</li>
      <li>Mijn Levenspad will refund the payment already received from the Client, minus any depreciation and any costs as referred to in paragraph 12, as soon as possible, but no later than 14 days after withdrawal of the Agreement, to the Client, provided that any Products to be returned have been received back by Mijn Levenspad, or the Client has demonstrated that the Products have actually been returned. Insofar as the withdrawal relates to an Agreement between Client and Coach, repayment is made by Mijn Levenspad.</li>
      <li>If the right of withdrawal is only exercised with regard to a part of the order of Products, any delivery costs initially paid by the Client are not eligible for a refund or remission.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 7. | PRICES, CREDITS, AND PAYMENTS BY CLIENTS</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>The rates that apply for purchasing Sessions, purchasing Credits, providing Content, and delivering Products are determined by Mijn Levenspad and communicated via the Platform.</li>
      <li>For purchasing a Session, the Client must pay in the manner prescribed by Mijn Levenspad. Payment can be made, among other things, using Credits, a package, or another payment method offered via the Platform. The way in which a Session can be paid for is stated by Mijn Levenspad on the Platform.</li>
      <li>If and insofar as Credits are used for a Session, the number of Credits, their value, and the way in which Credits can be used are stated by Mijn Levenspad on the Platform.</li>
      <li>Credits are credited to the Client's Account after purchase.</li>
      <li>During an ongoing Session, the Client can, if and insofar as the Platform provides for this and the Coach is willing, purchase additional Credits to extend the Session. If insufficient balance is available and no timely extension takes place, the Session ends by operation of law as soon as the available credit has been used up or the paid session duration has expired.</li>
      <li>Unless expressly stated otherwise, Credits are personal, non-transferable, and cannot be exchanged for money.</li>
      <li>Mijn Levenspad is entitled to charge transaction costs per transaction. These are explicitly stated prior to concluding the relevant Agreement.</li>
      <li>Payment by the Client must be made in the manner indicated for this by Mijn Levenspad, including payment via a payment service provider engaged by it.</li>
      <li>A payment only counts as received when the relevant amount has actually been received and authorized by Mijn Levenspad or the payment service provider engaged by it.</li>
      <li>If a payment is refused, reversed, or charged back, Mijn Levenspad is entitled to suspend the execution of the relevant Agreement, block access to the Platform or parts thereof, not credit Credits or correct already credited Credits, not allow a Session to start or continue, and suspend access to Content or delivery of Products, without prejudice to its other rights.</li>
      <li>Mijn Levenspad is entitled to make invoices and other payment communications available to the Counterparty exclusively electronically.</li>
      <li>If the Counterparty does not meet their payment obligation on time, default towards a Counterparty who is a Client only occurs after Mijn Levenspad has reminded them In Writing to pay within a period of fourteen days after the day of receipt of that reminder, stating the consequences of non-payment, and payment has not been made within that period. Regarding a Counterparty not acting as a Client, default occurs by operation of law at the moment the applicable payment term has expired.</li>
      <li>From the day that the Counterparty's default commences, the Counterparty owes the then applicable statutory interest on the outstanding amount, provided that the statutory commercial interest is due from a Counterparty who does not act as a Client.</li>
      <li>All reasonable costs, such as judicial, extrajudicial, and execution costs incurred to obtain the amounts owed by the Counterparty, are borne by the Counterparty.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 8. | CONTENT</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Mijn Levenspad is entitled to further determine the nature, content, scope, structure, and manner of provision of Content. Content may include online training, courses, e-learning, documentation, teaching materials, and other digital content.</li>
      <li>The Client only obtains a personal, limited, revocable, non-exclusive, and non-transferable right of use with regard to the Content, solely for personal use and within the boundaries of the Agreement with Mijn Levenspad.</li>
      <li>Mijn Levenspad is entitled to adapt, update, or modify Content technically, substantively, or functionally from time to time, provided that the nature and essential purpose of the relevant Content are not substantially affected thereby.</li>
      <li>The Client is personally responsible for the equipment, software, internet connection, and other facilities required to be able to use the Content.</li>
      <li>The Client is not permitted to copy, reproduce, download (other than insofar as a Platform feature provides for this), publish, make available to third parties, distribute, sell, or otherwise use Content or parts thereof in a manner that falls outside the boundaries of the Agreement with Mijn Levenspad.</li>
      <li>The Client must report complaints about Content to Mijn Levenspad within a reasonable time after discovering a defect.</li>
      <li>The provisions of this article do not affect the mandatory rights of the Client regarding the conformity of the Content with the Agreement.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 9. | PRODUCTS</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>The offer of Products is valid while supplies last. If a Product appears not to be deliverable or not on time after conclusion of the Agreement, Mijn Levenspad is entitled to dissolve the Agreement insofar as it relates to that Product. In that case, the Client is only entitled to a refund of the amount paid for the relevant Product.</li>
      <li>Delivery of Products takes place at the delivery address specified by the Client.</li>
      <li>The delivery times specified by Mijn Levenspad or agreed with the Client are indicative, non-fatal deadlines. Mijn Levenspad's default does not occur until after the Client has declared it in default In Writing, in which notice of default a reasonable period for performance is stated, and Mijn Levenspad remains in default of performance after the expiration of that period.</li>
      <li>If Mijn Levenspad is dependent on performances to be delivered by third parties for the delivery of Products, it is not liable for delays resulting from circumstances that cannot reasonably be attributed to it.</li>
      <li>The risk of loss and damage to Products transfers to the Client at the moment of actual receipt by the Client or a third party designated by them, who is not the carrier.</li>
      <li>If the Client believes that a delivered Product does not comply with the Agreement, they must report this to Mijn Levenspad within a reasonable time after discovering it or should reasonably have discovered it. Complaints relating to non-conformity must be reported to Mijn Levenspad within a reasonable time after discovery, whereby a period of two months after discovery is in any case considered timely.</li>
      <li>The provisions of the previous paragraphs do not affect the mandatory rights of the Client with respect to conformity. A Product must comply with the Agreement and the Client retains the statutory rights to which they are entitled in that regard.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 10. | USE OF THE PLATFORM, OBLIGATIONS, AND RULES OF CONDUCT</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>The Counterparty is obliged to use the Platform in accordance with these terms and conditions and the applicable laws and regulations.</li>
      <li>The Counterparty must behave respectfully, carefully, and responsibly when using the Platform and in contact with Mijn Levenspad, other users of the Platform, and other parties involved.</li>
      <li>The Counterparty is not permitted to use the Platform in a manner that causes or may cause nuisance, damage, disruption, abuse, or safety risks for Mijn Levenspad, other users, or third parties.</li>
      <li>The Counterparty is not permitted to make offensive, discriminatory, threatening, intimidating, sexually transgressive, misleading, or otherwise inappropriate statements or display such behavior via the Platform.</li>
      <li>The Counterparty is not permitted to provide incorrect, incomplete, or misleading information to Mijn Levenspad or, insofar as applicable, to another user of the Platform.</li>
      <li>If the Client participates in a Session, they are obliged to be available on time and to provide the cooperation required for the Session. If the Client is not available on time or otherwise provides insufficient cooperation, the consequences are at their expense and risk.</li>
      <li>The Coach is obliged to carry out Sessions in a careful, respectful, and professional manner, taking into account the nature of the services offered via the Platform and the reasonable quality and conduct standards that Mijn Levenspad makes known in connection with the Platform.</li>
      <li>The Coach is not permitted to make medical diagnoses, prescribe medication, offer medical treatments, or otherwise give medical advice during or in connection with a Session.</li>
      <li>The Coach must refrain from statements or conduct that are misleading, inappropriate, transgressive, or otherwise careless for Clients, including creating unrealistic expectations about the outcome or effect of a Session.</li>
      <li>The Counterparty understands and accepts that the Sessions offered via the Platform and the Content made available by Mijn Levenspad may have a spiritual, coaching, or guiding character and cannot be regarded as medical, psychiatric, psychological, or any other form of regulated care.</li>
      <li>The Platform, the Sessions offered via the Platform, and the Content made available by Mijn Levenspad are not intended for emergency care, crisis situations, or acute medical or psychological problems, including suicidality, severe depressive symptoms, or other situations where immediate professional assistance is required. In such cases, the person concerned should contact a doctor, care provider, emergency service, or other appropriate body.</li>
      <li>If a Counterparty acts contrary to the provisions of this article, Mijn Levenspad is entitled to take appropriate measures, including giving instructions, limiting functionalities, suspending access to the Platform or parts thereof, and terminating the Account or the relevant Agreement, without prejudice to its other rights.</li>
      <li>If the Client has complaints about the substantive execution of a Session, they must make this known to the relevant Coach as soon as possible. Mijn Levenspad can optionally facilitate the communication or settlement, but is not responsible for the substantive execution of the Session.</li>
      <li>If a Session does not take place, is interrupted, or ends prematurely as a result of the Client not appearing (on time), the Coach not appearing (on time), technical malfunctions, or other circumstances surrounding the execution of the Session, Mijn Levenspad is entitled to set further rules regarding its settlement, including whether or not to refund Credits, restitution, or rescheduling the Session.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 11. | COACHES</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>The Coach performs their work via the Platform exclusively in the exercise of their profession or business and on an independent basis.</li>
      <li>There is no employment contract, no relationship of authority, and no other legal relationship between Mijn Levenspad and the Coach that can be considered employment or an equivalent relationship.</li>
      <li>The Coach is personally responsible for the content, execution, and settlement of the Sessions provided by them, as well as for their communication and behavior towards Clients.</li>
      <li>The Coach performs their work for their own account and risk and is personally responsible for their business operations.</li>
      <li>The Coach is personally responsible for complying with all statutory obligations resting on them in connection with their work via the Platform, including tax obligations and, insofar as applicable, obligations relating to registrations, permits, and insurance.</li>
      <li>The Coach is personally responsible for the remittance of sales tax, income tax, and other taxes, premiums, and levies related to their work via the Platform, insofar as applicable.</li>
      <li>The Coach guarantees that they are entitled to perform their work via the Platform and that they have the knowledge, experience, and other qualities that may reasonably be expected of them in connection with the Sessions they offer.</li>
      <li>The Coach is obliged to keep their profile information, description, expertise, and other information placed on the Platform by or on their behalf accurate, complete, and up-to-date.</li>
      <li>The Coach is obliged to comply with the reasonable quality standards, rules of conduct, technical requirements, and other conditions for admission to and use of the Platform made known by Mijn Levenspad, on the understanding that these are not deemed to create a relationship of authority.</li>
      <li>The Coach is personally responsible for having a reliable internet connection, suitable equipment, and other technical facilities necessary for offering and executing Sessions via the Platform.</li>
      <li>The Coach is obliged to carefully execute Sessions at the agreed times or times made known via the Platform and to provide the cooperation reasonably necessary for this.</li>
      <li>If the Coach falls short in fulfilling their obligations towards a Client or otherwise acts carelessly, unlawfully, or contrary to these general terms and conditions, the consequences thereof are at their own expense and risk.</li>
      <li>The Coach indemnifies Mijn Levenspad against all claims from Clients, government agencies, and other third parties related to the Sessions provided by them, their tax position, business operations, behavior, or other circumstances attributable to them.</li>
      <li>The Coach particularly indemnifies Mijn Levenspad against claims from the Tax Authorities or other competent authorities regarding taxes, premiums, levies, fines, interest, or related claims associated with the Coach's work or the legal relationship between Mijn Levenspad and the Coach.</li>
      <li>If Mijn Levenspad incurs costs, suffers damage, or is held liable for payment in connection with a claim as referred to in the previous paragraphs, the Coach is obliged to fully compensate Mijn Levenspad for this.</li>
      <li>If the Coach acts contrary to the Agreement with Mijn Levenspad (including the provisions of these general terms and conditions), the law, or the reasonable interests of Mijn Levenspad, Clients, or the Platform, Mijn Levenspad is entitled to take appropriate measures, including giving instructions, limiting functionalities, suspending access to the Platform, and terminating the Agreement with Mijn Levenspad, without prejudice to its other rights.</li>
      <li>The Coach is personally responsible for having professional or business liability insurance, if and insofar as this can reasonably be expected of them given the nature of their work.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 12. | FEES AND PAYOUTS REGARDING COACHES</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>The Coach owes Mijn Levenspad the monthly fee expressly agreed upon In Writing between the parties.</li>
      <li>The amounts paid by Clients for Sessions are received by Mijn Levenspad and administratively processed via the Platform and/or the payment service provider engaged by it.</li>
      <li>Unless expressly agreed otherwise In Writing, the Coach is only entitled to payout of the portion of the fee paid by the Client for a Session that remains after deduction of VAT and transaction costs.</li>
      <li>Mijn Levenspad is entitled to take into account chargebacks, corrections, the Client's right of withdrawal, uncollected amounts, and other items relevant under the legal relationship between Mijn Levenspad and the Coach or based on the actual payment processing when calculating the amount to be paid out to the Coach.</li>
      <li>Payout to the Coach generally takes place monthly, unless expressly agreed otherwise In Writing or another payout frequency is set via the Platform.</li>
      <li>Mijn Levenspad is entitled to suspend payouts to the Coach if and as long as the Coach does not fulfill their obligations towards Mijn Levenspad, if there is reasonable doubt about the accuracy of the data underlying the payout, if there is a dispute with a Client, if a refund or correction is reasonably expected, or if suspension is otherwise justified to protect Mijn Levenspad or third parties.</li>
      <li>Mijn Levenspad is entitled to offset what it owes to the Coach against everything the Coach owes to it for whatever reason.</li>
      <li>The Coach is obliged to pay invoices from Mijn Levenspad within the period stated thereon. If no specific payment term is stated, a payment term of 14 days after the invoice date applies.</li>
      <li>A complaint from the Coach regarding an invoice, settlement, or payout must be submitted to Mijn Levenspad In Writing within five days after the Coach has taken note of it or should reasonably have taken note of it. Such a complaint does not suspend the Coach's payment obligations unless Mijn Levenspad expressly confirms otherwise In Writing.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 13. | DURATION, CANCELLATION, AND TERMINATION REGARDING COACHES</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>The Agreement with Mijn Levenspad between it and the Coach is entered into for an indefinite period, unless expressly agreed otherwise In Writing.</li>
      <li>The Coach is entitled to cancel the Agreement with Mijn Levenspad with a notice period of one month.</li>
      <li>Cancellation by the Coach must be done In Writing.</li>
      <li>Mijn Levenspad is entitled to cancel the Agreement with Mijn Levenspad with the Coach with a notice period of one month.</li>
      <li>Mijn Levenspad is entitled to suspend or terminate the Agreement with Mijn Levenspad in whole or in part with immediate effect if the Coach fails to fulfill their obligations under the Agreement, these general terms and conditions, or the law, or fails to do so on time or properly, unless the Coach's shortcoming does not reasonably justify this measure.</li>
      <li>Mijn Levenspad is furthermore entitled to suspend or terminate the Agreement with Mijn Levenspad in whole or in part with immediate effect if:
        <ul className="list-[lower-alpha] pl-6 mt-2 space-y-1">
          <li>the Coach is in a state of bankruptcy, an application for this has been filed, has applied for a suspension of payments, terminates or liquidates their business, or can otherwise no longer freely dispose of their assets;</li>
          <li>there are well-founded fears that the Coach will not be able to fulfill their obligations;</li>
          <li>the Coach has provided incorrect or misleading data upon admission to or use of the Platform;</li>
          <li>the Coach acts in a way that is or could be harmful to the good name, operation, safety, or reliability of Mijn Levenspad or the Platform;</li>
          <li>the Coach acts contrary to the reasonable quality and conduct standards that apply to the use of the Platform.</li>
        </ul>
      </li>
      <li>In the event of termination of the Agreement with Mijn Levenspad with the Coach, for whatever reason, Mijn Levenspad is entitled to terminate or restrict the Coach's access to the Platform and their Account with immediate effect.</li>
      <li>Termination of the Agreement with Mijn Levenspad does not affect payment obligations of the Coach that arose before the time of termination.</li>
      <li>Amounts that the Coach owes to Mijn Levenspad at the time of termination remain fully due and become immediately payable, unless the nature of the relevant obligation dictates otherwise.</li>
      <li>After termination of the Agreement with Mijn Levenspad, Mijn Levenspad is not obliged to give the Coach further access to the Platform, their profile, their Account data, or other data or functionalities available via the Platform.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 14. | LIABILITY</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Mijn Levenspad acts exclusively as a facilitating, technical, and organizational platform with regard to Sessions. It only commits to a best-efforts obligation in the context of its services and can never guarantee that the results intended by the Counterparty using the Platform, a Session, Content, Credits, or Products will be achieved.</li>
      <li>Insofar as the use of the Platform or the execution of an Agreement with Mijn Levenspad is partly dependent on third-party services, Mijn Levenspad does not guarantee the continuous availability or faultless operation of those services. This does not affect its obligations under the Agreement with Mijn Levenspad and applicable law.</li>
      <li>Mijn Levenspad is not a party to the Agreement between Client and Coach and is never liable for the content, method of execution, quality, outcome, or further settlement of a Session.</li>
      <li>Mijn Levenspad bears no liability for damage in connection with or damage caused by an inaccuracy or incompleteness in the information provided by the Counterparty or the Coach, a failure to fulfill the obligations of the Counterparty or the Coach arising from the law or the Agreement, or any other circumstance that cannot be attributed to Mijn Levenspad.</li>
      <li>Mijn Levenspad is never liable for indirect damage, including suffered loss, lost profit, missed savings, damage as a result of business stagnation, and other consequential damage.</li>
      <li>Should Mijn Levenspad, despite the provisions of these general terms and conditions, be liable for any damage, it has the right at all times to repair this damage. The Counterparty must give Mijn Levenspad the opportunity to do so, failing which any liability of Mijn Levenspad in this respect lapses.</li>
      <li>Mijn Levenspad's liability is, except for intent and willful recklessness on its part, limited to at most the invoice value of the Agreement with Mijn Levenspad, or at least to that part of that Agreement to which Mijn Levenspad's liability relates.</li>
      <li>In derogation from the statutory limitation period, the limitation period for all claims and defenses against Mijn Levenspad is one year. In derogation from the previous sentence, claims and defenses accruing to Clients based on facts that would justify the assertion that a consumer purchase does not comply with the Agreement become time-barred after two years.</li>
      <li>Legal actions and defenses of Clients based on facts that would justify the assertion that Content does not comply with the Agreement become time-barred after two years following the provision of the Content, unless the Client did not know or ought not to have known of the defect, in which case the provisions of the previous paragraph apply.</li>
      <li>In the case of a consumer purchase, the limitations in this article do not extend further than is permitted under Article 7:24 paragraph 2 of the Dutch Civil Code.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 15. | INTELLECTUAL PROPERTY</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>All intellectual property rights regarding the Platform, the design, software, texts, images, trademarks, logos, data files, Content, and other materials present on it, reside exclusively with Mijn Levenspad or its licensors.</li>
      <li>Except insofar as the nature or purport of the Agreement with Mijn Levenspad dictates otherwise, the Counterparty only obtains the non-exclusive, non-transferable, and revocable usage rights expressly following from these general terms and conditions.</li>
      <li>The Counterparty is not permitted to duplicate, publish, reproduce, edit, decompile, resell, make available to third parties, or otherwise use the items referred to in paragraph 1 or parts thereof in a manner that falls outside the boundaries of the Agreement with Mijn Levenspad, unless Mijn Levenspad has explicitly given permission for this In Writing.</li>
      <li>Insofar as the Counterparty makes information, texts, images, profile content, reviews, comments, messages, or other materials available to Mijn Levenspad or via the Platform, the relevant Counterparty guarantees that they are entitled to do so and that no rights of third parties are infringed thereby.</li>
      <li>The Counterparty grants Mijn Levenspad, insofar as necessary for the use, operation, and exploitation of the Platform, a non-exclusive right valid for the duration of the legal relationship with Mijn Levenspad to use, duplicate, publish, and otherwise process the materials referred to in the previous paragraph, solely to the extent reasonably necessary for the performance of the Agreement with Mijn Levenspad and the exploitation of the Platform.</li>
      <li>If the Coach provides profile information, photos, descriptions, texts, or other materials for their presentation on the Platform, Mijn Levenspad is entitled to use these materials in the context of placement on the Platform and Mijn Levenspad's related promotional communications, unless explicitly agreed otherwise In Writing.</li>
      <li>An infringement of its intellectual property rights or those of its licensors ascertained or reasonably suspected by Mijn Levenspad gives it the right to take appropriate measures without prior notice, including removing Content or other materials, blocking access to the Platform, suspending the Agreement, and claiming damages.</li>
      <li>The Counterparty indemnifies Mijn Levenspad against all claims from third parties based on the assertion that materials supplied by or placed via the Counterparty infringe intellectual property rights or other rights of third parties.</li>
    </ol>

    <h2 className="text-xl font-semibold mt-8 mb-4">ARTICLE 16. | FINAL PROVISIONS</h2>
    <ol className="list-decimal pl-6 mb-4 space-y-2">
      <li>Dutch law exclusively applies to every Agreement and all legal relationships arising from it between the parties.</li>
      <li>Before turning to the court, the parties are obliged to make every effort to resolve disputes amicably.</li>
      <li>Only the competent court within the district of the District Court of The Hague (Netherlands) is designated to hear any legal disputes in the first instance, without prejudice to Mijn Levenspad's right to designate another court competent according to the law.</li>
      <li>If the Counterparty is a Client, they are entitled to choose the court competent according to the law within one month after Mijn Levenspad has announced In Writing that it wishes to litigate before the court designated by it.</li>
      <li>Mijn Levenspad is entitled to amend these general terms and conditions. Amended general terms and conditions apply to already existing Agreements from 60 days after they have been brought to the attention of the Counterparty.</li>
      <li>If these terms and conditions are available in more than one language, the Dutch version is decisive for the interpretation of their content and purport.</li>
    </ol>
  </>
);

const TermsZH = () => (
  <>
    <h2 className="text-xl font-semibold mt-8 mb-4">第 1 条 | 定义</h2>
    <p className="mb-4">本条款中的术语（如平台、来访者、教练、积分、内容、产品、账户等）按其在本协议中的定义解释。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 2 条 | 一般条款</h2>
    <p className="mb-4">本条款适用于 Mijn Levenspad 提供的服务、平台使用及相关法律关系。来访者与教练之间的会话协议与平台协议相互区分，平台对会话内容本身不作为合同一方。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 3 条 | 合同成立</h2>
    <p className="mb-4">报价一般不具约束力；当用户按平台流程完成接受并满足条件时，相关协议成立。平台可基于合理原因拒绝注册或请求。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 4 条 | 账户与平台使用</h2>
    <p className="mb-4">用户需提供真实信息并妥善保管账户凭据。平台可在违反条款、法律或合理利益受损时限制或终止账户。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 5 条 | 平台角色</h2>
    <p className="mb-4">Mijn Levenspad 提供技术与组织层面的撮合和基础设施服务，不对教练会话的具体内容、质量或结果承担责任。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 6 条 | 撤回权</h2>
    <p className="mb-4">消费者在法律允许范围内享有撤回权；对已履行的服务、已使用积分或法律排除情形，撤回权可能受限。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 7 条 | 价格、积分与支付</h2>
    <p className="mb-4">价格、积分规则及支付方式以平台显示为准。付款失败、拒付或撤销时，平台可暂停服务、调整积分或限制访问。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 8 条 | 内容</h2>
    <p className="mb-4">用户对内容仅享有限、可撤销、不可转让的使用权。未经许可不得复制、传播、转售或用于协议范围外目的。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 9 条 | 产品</h2>
    <p className="mb-4">产品供货受库存与交付条件约束。消费者在法律范围内享有与不符合约定（non-conformity）相关权利。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 10 条 | 行为规范</h2>
    <p className="mb-4">禁止滥用、骚扰、欺诈或危害平台安全的行为。平台上的辅导与精神支持不构成紧急医疗服务或受监管医疗服务。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 11 条 | 教练条款</h2>
    <p className="mb-4">教练作为独立主体开展服务并自行承担税务、合规与职业责任。平台与教练不构成劳动关系。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 12 条 | 教练费用与结算</h2>
    <p className="mb-4">平台可按约定进行费用计算、扣除与结算，并在存在争议、退单或合规风险时暂停或调整支付。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 13 条 | 期限与终止</h2>
    <p className="mb-4">协议可依约定或法定原因终止。发生违约、欺诈、破产风险或重大不当行为时，平台可立即限制或终止访问。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 14 条 | 责任限制</h2>
    <p className="mb-4">在法律允许范围内，平台责任受限；对间接损失、第三方服务中断及教练会话结果通常不承担责任。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 15 条 | 知识产权</h2>
    <p className="mb-4">平台及相关材料的知识产权归 Mijn Levenspad 或其许可方所有。未经书面许可，不得擅自复制、改编、发布或商业利用。</p>

    <h2 className="text-xl font-semibold mt-8 mb-4">第 16 条 | 最终条款</h2>
    <p className="mb-4">本条款受荷兰法管辖；争议由有管辖权法院处理。若多语言版本存在差异，以荷兰语版本解释为准。</p>
  </>
);

const TermsAndConditionsPage = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const ui = legalUiCopy[language];
  const hasLocalizedBody = language === "en" || language === "nl" || language === "zh";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-6 py-24 max-w-4xl relative">
        <Button 
          variant="ghost" 
          className="mb-6 -ml-4 flex items-center gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={20} />
          {ui.back}
        </Button>
        <h1 className="text-3xl font-bold mb-4">{ui.title}</h1>
        {!hasLocalizedBody && (
          <div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-md text-sm">
            {ui.fallback}
          </div>
        )}
        <div className="prose prose-slate dark:prose-invert max-w-none" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {language === "nl" ? <TermsNL /> : language === "zh" ? <TermsZH /> : <TermsEN />}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsAndConditionsPage;
