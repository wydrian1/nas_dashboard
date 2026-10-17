import type { Chapter, Requirement, Rule } from '../types.ts';
import { bindScene, itemArts } from '../presentation/index.ts';

const id = (name: string) => `relay:${name}`;
const target = (name: string) => ({ kind: 'environment' as const, id: id(name) });
const env = (name: string, label: string, description: string, requires?: Requirement) => ({ id: id(name), label, description, requires });
const exit = (name: string, label: string) => ({ id: id(name), label });
const look = (name: string, message: string, extra: Partial<Rule> = {}): Rule => ({ id: id(`look:${name}`), label: 'Megvizsgálom', kind: 'look', interaction: { verb: 'look', target: target(name) }, requires: { discoveries: [id(name)] }, message, ...extra });
const operate = (name: string, suffix: string, message: string, extra: Partial<Rule> = {}): Rule => ({ id: id(`use:${name}:${suffix}`), label: 'Működtetem', kind: 'use', interaction: { verb: 'use', target: target(name) }, requires: { discoveries: [id(name)] }, message, ...extra });
const move = (name: string, to: string, message: string, requires?: Requirement): Rule => ({ id: id(`move:${name}`), label: 'Továbbmegyek', kind: 'move', interaction: { verb: 'move', target: { kind: 'exit', id: id(name) } }, moveTo: to, requires, message });
const phase = (flags: string[], withoutFlags: string[] = []): Requirement => ({ flags: flags.map(id), withoutFlags: withoutFlags.map(id) });

export const relay: Chapter = {
  id: 'relay', title: 'III. A címzett helye', items: { 'relay:blank-seal': 'Átlyukasztatlan ólompecsét' },
  itemDescriptions: { 'relay:blank-seal': 'Lapos, puha fémből nyomott pecsét. A lyuk helyén csak egy hajszálvékony kör látszik; a prés sosem ért le odáig. A hátlapján egy apró lépcsős jel van, ugyanaz, amelyet az ellensúlyakna túlsó falán láttál. Nincs rajta szám vagy név.' },
  itemArt: itemArts(['relay:blank-seal']),
  goals: [
    { text: 'Juss el az alsó Fogadóállomásra: a tábla szerint ott kérheted az ébresztésed felülvizsgálatát.', requires: phase(['destination-known'], ['received']) },
    { text: 'Keresd meg az eredeti ébresztési kérelmet. A kapott válasz a túloldali olvasóhoz irányít.', requires: phase(['received']) },
  ],
  connections: [{ from: 'archive:record-room', exits: [exit('entry', 'A sínek mögötti személyzeti átjáró')], artSpots: bindScene('connection:relay:entry').artSpots, rules: [{ ...move('entry', id('gallery'), 'Az iratsínek mögött keskeny galéria kezdődik. A falon kopott nyíl és egy sokszor javított tábla: „ÉBRESZTÉSI FELÜLVIZSGÁLAT — ALSÓ FOGADÓÁLLOMÁS”. Az archívum jele fölé ezt bélyegezték: „MÁSOLATŐRZÉS”.'), addFlags: [id('destination-known')] }] }],
  scenes: {
    'relay:gallery': {
      title: '07 · Az átvezető galéria', description: 'Az iratsínek mögötti személyzeti járda az alsó Fogadóállomás felé vezet. Az útjelző szerint ott kérheted az ébresztésed iratainak felülvizsgálatát. A falon üvegezett óralap, a korlát alatt összecsukott vászonhordágy; a járda végén sötét ajtó.',
      arrivalDiscoveries: ['notice', 'clock', 'stretcher'].map(id),
      environment: [env('notice', 'Felülvizsgálati tábla', 'A nyíl lefelé mutat. A tábla négy sarkát más-más csavarral rögzítették; az alján egy eltérő betűtípusú javítás van.'), env('clock', 'Üvegezett óralap', 'A kör alakú üveg mögött nem mutatók járnak. Három sugárirányú rés, egy lapos bütyök és két egymás melletti csap látszik.'), env('stretcher', 'Összecsukott hordágy', 'A vásznon kilenc keskeny csíkban kopott ki a szövet. Nem emberalakot adnak ki. A fémfogantyú belső oldalán meleg pára ül, a külső oldala hideg.')],
      exits: [exit('gallery-back', 'Vissza a függő irattárba'), exit('interval', 'A sötét ajtó mögé')],
      ...bindScene('relay:gallery'),
      rules: [look('notice', '„Az archívum másolatot őriz. Az eredeti ébresztési kérelem felülvizsgálatát az ALSÓ FOGADÓÁLLOMÁSON lehet kérni.” A javított sor szerint a továbbjutáshoz nem kell megadnod a nevedet: elég az ébresztés helyi jelölése. A tábla megnevez egy helyet, ahol utánanézel annak, ami veled történt.', { addFlags: [id('destination-known')], notes: ['A felülvizsgálati tábla az alsó Fogadóállomást jelöli meg; az archívum másolatot őriz. Személynév helyett helyi ébresztési jelölést kérnek.'], milestone: { id: id('direction'), title: 'Egy hely, ahová el lehet jutni', text: 'A sínek mögötti táblán az állt, hogy az archívum másolatot őriz. Az eredeti ébresztési kérelem felülvizsgálatát máshol, az alsó Fogadóállomáson veszik át. Ez nem mondta meg, ki vagyok, és azt sem, miért ébredtem itt. De megnevezett egy helyet, ahol elkezdhettem utánajárni. A javított sor külön kiemelte: személynév nem szükséges.' } }),
        look('clock', 'Az óralap szélén kioldható pánt tartja az üveget. Közelről látszik, hogy a harmadik szakaszon nincs bütyök.', { focusTo: id('clock-detail') }),
        move('gallery-back', 'archive:record-room', 'A függő iratok közé visszatér a galéria fénye.'), move('interval', id('interval-room'), 'Az ajtó mögött a saját lépteid is tompábbak. A mennyezeten futó kábel minden harmadik felfüggesztése üres.'),
      ],
    },
    'relay:clock-detail': {
      detailOf: id('gallery'), title: 'Óralap · az üres harmad', description: 'A nyitott üveg alatt a kopott bütyöksor három szakasza látszik.', arrivalDiscoveries: [id('cam')],
      environment: [env('cam', 'A bütyöksor három szakasza', 'Az első szakaszon egyetlen széles bütyök ütötte a nyelvet. A másodikon két közeli csap. A harmadik sima: sem törés, sem javításnyom nincs rajta. A perembe vésve: „A kihagyás is ütem.”')],
      ...bindScene('relay:clock-detail'), rules: [],
    },
    'relay:interval-room': {
      title: '08 · A kihagyott ütemek terme', description: 'A továbbvezető átjáró három reteszét a fal hangra mozduló szerkezete vezérli. Az egyik foglalatban ütőnyelv, a másikban kettős villa áll. A harmadik üresnek látszik, de az alján feszes hártya rezdül. A padló porában csak kifelé vezető lábnyomok vannak.',
      arrivalDiscoveries: ['single', 'double', 'rest', 'footprints'].map(id),
      environment: [env('single', 'Széles ütőnyelv', 'A súlyos nyelv mögött egyetlen rézlap ül. A fogásra kopott perem rugózik; elengedve egyet üt.'), env('double', 'Kettős villa', 'A két ág között alig egy ujjnyi a távolság. A rugó egyszerre szabadítja fel őket, de nem egyszerre érik a falat.'), env('rest', 'Üres foglalat hártyája', 'A harmadik foglalatból nem tört ki semmi. Vékony hártyája a terem hangjára mozdul. Közel hajolva azt is hallod, amikor a másik két szerkezet elhallgat.'), env('footprints', 'Kifelé vezető lábnyomok', 'A porban mindkét cipő sarka az ajtó felé mutat, az orruk viszont a galéria felé. A talprajz nem látszik csúsztatottnak. Az utolsó lenyomat félbeszakad a küszöb előtt.')],
      exits: [exit('interval-back', 'Vissza a galériára'), exit('well', 'Az ellensúlyaknához')],
      ...bindScene('relay:interval-room'),
      rules: [operate('single', 'start', 'Egy tompa ütés. A bal retesz behúzódik, a másik kettő visszaül a helyére.', { requires: phase([], ['rhythm-open']), addFlags: [id('beat-one')], removeFlags: [id('beat-two')] }),
        operate('double', 'second', 'A két gyors koppanás után a középső retesz is behúzódik. A fal zengése lassan elvékonyodik.', { requires: phase(['beat-one'], ['rhythm-open']), addFlags: [id('beat-two')], removeFlags: [id('beat-one')] }),
        operate('double', 'restart', 'Két koppanás fut végig a falon. A reteszek röviden megremegnek, majd mind visszazárnak.', { requires: phase([], ['beat-one', 'rhythm-open']), removeFlags: [id('beat-two')] }),
        look('rest', 'Megvárod, amíg a villa utolsó rezgése is elül. A hártya kisimul; a harmadik retesz akkor húzódik be, amikor már semmit sem hallasz. Az ajtó alján egy rögzítőnyelv kattan a nyitott állásba.', { id: id('look:rest:complete'), requires: phase(['beat-two'], ['rhythm-open']), addFlags: [id('rhythm-open')], removeFlags: [id('beat-two')], notes: ['A harmadik ütem nem hang volt, hanem az elhallgatás. Az akna ajtajának reteszei behúzódtak.'] }),
        look('rest', 'A hártya egy pillanatra kisimul, de a másik két szerkezet rezgése nem illik ehhez az ütemhez. A reteszek a helyükön maradnak.', { requires: phase([], ['beat-two', 'rhythm-open']), removeFlags: [id('beat-one')] }),
        ...['single', 'double'].map(name => operate(name, 'latched', 'A hang végigfut a falon, de a reteszeket már a nyitott állásba kattant rögzítőnyelv tartja.', { requires: phase(['rhythm-open']) })),
        look('rest', 'A hártya kisimul. Az ajtó alatt a rögzítőnyelv nyitott állásban tartja mindhárom reteszt.', { id: id('look:rest:latched'), requires: phase(['rhythm-open']) }),
        move('interval-back', id('gallery'), 'A galérián megint hallod az iratsínek fémes súrlódását.'), move('well', id('well-room'), 'A nyitott reteszek között keskeny lépcső kanyarodik az ellensúlyaknán át.', phase(['rhythm-open'])),
        { ...move('well', id('well-room'), 'Az ajtó három lapos retesze közül még nem húzódott be mind. A falon a harmadik foglalat teljesen üres.', phase([], ['rhythm-open'])), id: id('move:well:closed'), moveTo: undefined },
      ],
    },
    'relay:well-room': {
      title: '09 · Az ellensúlyakna', description: 'A Fogadóállomás alsó szintjére felvonó vezet, de a kosár a járda alatt áll. Két visszaforgatható kézikerékkel állíthatók a külön köteleken függő ellensúlyok: egy háromágú villa és egy rövid keresztgerenda. A fal krétavonalai a helyzetük összehasonlítását segítik. A párkányon régi pecsétprés áll.',
      arrivalDiscoveries: ['left-wheel', 'right-wheel', 'alignment', 'ledge'].map(id),
      environment: [env('left-wheel', 'Bal kézikerék', 'A küllők között három ütköző van. Mindegyik fordítás egy szinttel emeli a háromágú villát, a harmadik visszaereszti az alsó jelhez.'), env('right-wheel', 'Jobb kézikerék', 'Három ütközője a keresztgerenda magasságát váltja. A kötélen egyetlen ép piros fonál fut; minden más szál fakó.'), env('alignment', 'Krétavonalak és kötelek', 'A falon a villa felső árnyéka és a keresztgerenda középső árnyéka találkozik. Nem számok: a körvonalaik együtt egy hiánytalan lépcsőt rajzolnak. Az akna szájánál kettévágott lépcsőjel van a záron.'), env('ledge', 'Poros párkány', 'Egy üres pecsétprés áll a párkányon. A talpa körül finom fémforgács, a prés alatt kerek mélyedés. A fogantyúra kötött zsinór végét gondosan eldolgozták.'), env('loose-seal', 'Átlyukasztatlan pecsét', 'A prés alatt egy puha ólomlap hever. A közepén a lyuk helye megvan, de a fémet nem ütötték át.', { withoutItems: [id('blank-seal')] })],
      exits: [exit('well-back', 'Vissza az ütemek termébe'), exit('dispatch', 'Le a küldeményfülkéhez')],
      ...bindScene('relay:well-room'),
      rules: [
        ...(['left', 'right'] as const).flatMap(side => [
          operate(`${side}-wheel`, 'low-mid', `A ${side === 'left' ? 'háromágú villa' : 'keresztgerenda'} a középső jelhez emelkedik. A racsni csendesen megtartja.`, { requires: phase([], [`${side}-mid`, `${side}-high`]), addFlags: [id(`${side}-mid`)] }),
          operate(`${side}-wheel`, 'mid-high', `A ${side === 'left' ? 'villa' : 'keresztgerenda'} eléri a felső krétajelet. A kötél feszes marad.`, { requires: phase([`${side}-mid`]), addFlags: [id(`${side}-high`)], removeFlags: [id(`${side}-mid`)] }),
          operate(`${side}-wheel`, 'high-low', `A ${side === 'left' ? 'villa' : 'keresztgerenda'} lassan visszaereszkedik az alsó jelhez.`, { requires: phase([`${side}-high`]), removeFlags: [id(`${side}-high`)] }),
        ]),
        look('alignment', 'A villa fent, a keresztgerenda középen áll. A körvonalaik a krétajelnél egyetlen lépcsővé záródnak; az akna zárja átbillen. Egy fogaskerék még fordul, aztán a felvonókosár a járdához simul. A rögzítőfék külön sínbe ül.', { id: id('look:alignment:complete'), requires: phase(['left-high', 'right-mid']), addFlags: [id('lift-ready')], notes: ['A két ellensúly körvonala a krétajelnél összeállt; a felvonókosár feljött a járdához, rögzítőféke külön sínbe ült.'] }),
        look('alignment', 'A villa és a keresztgerenda árnyéka nem záródik össze. A bal kötél most lent fut; a falon a villa felső körvonala maradt meg a legélesebben.', { requires: phase([], ['left-mid', 'left-high']) }),
        look('alignment', 'A villa közepe egy szinttel a kréta körvonala alatt lóg. A zár két fél lépcsőjele nem ér össze.', { id: id('look:alignment:mid'), requires: phase(['left-mid']) }),
        look('alignment', 'A villa a felső krétajelnél áll, de a keresztgerenda másik szinten keresztezi. A lépcső középső foka hiányzik az árnyékból.', { id: id('look:alignment:high'), requires: phase(['left-high'], ['right-mid']) }),
        look('ledge', 'A prés talpát félrebillentve egy átlyukasztatlan pecsét tűnik elő. A kész példányok sorának itt nincs folytatása.', { discover: [id('loose-seal')] }),
        { id: id('take:seal'), label: 'Felveszem', kind: 'take', interaction: { verb: 'take', target: target('loose-seal') }, requires: { discoveries: [id('loose-seal')], withoutItems: [id('blank-seal')] }, addItems: [id('blank-seal')], message: 'A puha pecsétet a zsebedbe teszed. A hátlapján egy lépcsős jel, más semmi. A prés nyomólapján ugyanez a jel fordítva áll.' },
        move('well-back', id('interval-room'), 'Az ütemek termében a hártya változatlanul feszes.'), move('dispatch', id('dispatch-room'), 'A kosár egyetlen szintet ereszkedik. Az alsó járdáról fülke nyílik, benne három irattálca.', phase(['lift-ready'])),
        { ...move('dispatch', id('dispatch-room'), 'A kosár a járda alatt áll. Az ajtó zárján a két fél lépcsőjel elcsúszik egymáshoz képest.', phase([], ['lift-ready'])), id: id('move:dispatch:closed'), moveTo: undefined },
      ],
    },
    'relay:dispatch-room': {
      title: '10 · A küldeményfülke', description: 'Itt lehet iratot beküldeni a Fogadóállomásra. A tejüveg ablak alatt három tálca különíti el a kéréseket: NÉV, JAVÍTÁS, HIÁNY. Fölöttük mechanikus kéz tart indigós lapot. Az ablak melletti házirend magyarázza a tálcák használatát; a túlsó ajtó résében meleg fény látszik.',
      arrivalDiscoveries: ['house-rule', 'hand', 'name-tray', 'correction-tray', 'missing-tray'].map(id),
      environment: [env('house-rule', 'Átvételi házirend', '„NÉV: személyadat pótlása. JAVÍTÁS: csatolt lap hibás adatának helyesbítése. HIÁNY: be nem mutatott eredeti bekérése.” Az utolsó sor alá valaki odaszúrta: „A másolat attól még nem lesz eredeti, hogy kétszer hozzák.”'), env('hand', 'Mechanikus másolókéz', 'A kéz ujjai tiszták, az indigólap csak a csukló fölött tintás. A tálcákhoz három huzal köti. Az alatta lógó címke: „CSAK AZ ÁTVÉTELT TANÚSÍTJA”.'), env('name-tray', 'NÉV tálca', 'Sekély fémvályú, alján sok egymásra másolt kézírás. A tálca végén négyzet alakú nyomógomb.'), env('correction-tray', 'JAVÍTÁS tálca', 'A vályú belsejét kivakart tintapacák borítják. A gombon látszik egy régi körömrepedés lenyomata.'), env('missing-tray', 'HIÁNY tálca', 'A fém alig kopott. A gomb mellett az indigólapnak megfelelő méretű, üres négyszög. A bekérőlap nem kínál névmezőt: „HELYI ÉBRESZTÉSI JELÖLÉS”.')],
      inputs: [{ id: id('missing-tray'), label: 'Helyi ébresztési jelölés', prompt: 'A bekérőlap két számhelye', maxLength: 2, format: 'digits' }],
      topics: [{ id: id('hand-task'), target: id('hand'), label: 'Mit tanúsít a kéz?' }, { id: id('hand-copy'), target: id('hand'), label: 'Kinek készül a másolat?' }],
      exits: [exit('dispatch-back', 'Fel az ellensúlyaknához'), exit('receiver', 'Az alsó Fogadóállomásra')],
      ...bindScene('relay:dispatch-room'),
      rules: [operate('name-tray', 'press', 'A kéz egy üres névmezőt másol le, majd visszahúzza a lapot. Az ablakon felvillan: „SZEMÉLYADAT NINCS MEGADVA”. A tálca végén nem nyílik rés.'), operate('correction-tray', 'press', 'A kéz az üres négyszög fölé hajol. „HELYESBÍTENDŐ EREDETI NINCS CSATOLVA” – nyomja a papírra, majd visszatekeri az indigót.'), operate('missing-tray', 'press', 'A két számhelyes bekérőlap előrecsúszik. Az ébresztési jelölés sor alatt nincs hely a nevednek.'),
        { id: id('submit:missing'), label: 'Bekérem az eredetit', kind: 'submit', interaction: { verb: 'submit', target: target('missing-tray'), input: '09' }, addFlags: [id('request-sent')], message: 'A kéz két ujja a 09 mellé nyom egy apró négyzetet. „EREDETI BEKÉRÉSE / HELYI JELÖLÉS: 09”. Az indigó alatt egy második lap indul el a falba; a meleg fényű ajtó zárja elenged.', notes: ['A HIÁNY tálcán a 09-es helyi ébresztési jelöléssel eredeti kérelmet kértem be. A kéz az átvételt tanúsította, nem a jelölés személyhez tartozását.'], milestone: { id: id('request'), title: 'Amit nem adtam meg', text: 'A névmezőt üresen hagytam. Nem egy meglévő lap adatát akartam kijavítani: az eredeti ébresztési kérelmet kértem be a falon látott 09-es helyi jelöléssel. A másolókéz apró négyzetet nyomott a két szám mellé. A papír elindult a falba, és a Fogadóállomás felőli ajtó kinyílt. A kéz csak azt igazolta, hogy a kérésemet átvette.' } },
        { id: id('talk:hand'), label: 'Megszólítom', kind: 'talk', interaction: { verb: 'talk', target: target('hand') }, message: 'Az ujjak nem mozdulnak. A csukló fölül rövid, előre rögzített mondat szól: „A fogadó nem köteles emlékezni a feladóra.”' },
        { id: id('talk:hand-task'), label: 'Kérdezek', kind: 'talk', interaction: { verb: 'talk', target: target('hand'), topic: id('hand-task') }, message: 'A kéz rámutat a saját címkéjére: „CSAK AZ ÁTVÉTELT TANÚSÍTJA”. Az indigólapon ugyanaz a három szó jelenik meg. Ez nem válasz arra, igaz-e bármi a beküldött lapon.' },
        { id: id('talk:hand-copy'), label: 'Kérdezek', kind: 'talk', interaction: { verb: 'talk', target: target('hand'), topic: id('hand-copy') }, message: 'A csukló fölül másik felvétel indul: „Egy példány a fogadónak. Egy a visszaútnak.” A második mondat végén az indigós lap üres fele lassan feléd fordul.' },
        move('dispatch-back', id('well-room'), 'A felvonókosár visszaemel a két kötél közé.'), move('receiver', id('receiver-room'), 'A meleg fényben egy alacsony pult és egy nyitott ablak rajzolódik ki. A falon: ALSÓ FOGADÓÁLLOMÁS.', phase(['request-sent'])),
        { ...move('receiver', id('receiver-room'), 'Az ajtó résében fény van, de a kilincs nem enged. A tejüveg mögött üres négyszög vár a bekérőlapon.', phase([], ['request-sent'])), id: id('move:receiver:closed'), moveTo: undefined },
      ],
    },
    'relay:receiver-room': {
      title: '11 · Az alsó Fogadóállomás', description: 'Az ablak nyitott, de nem a szabadba néz. Keskeny árok túloldalán egy sötét olvasóterem látszik. A pulton felülvizsgálati válaszcsík, mellette csőposta szája; a padlóban régi ülőhely csavarjainak négy üres lyuka.',
      arrivalDiscoveries: ['reply', 'window', 'tube-mouth', 'bolt-holes'].map(id),
      environment: [env('reply', 'Válaszcsík a pulton', 'A csík felső szélén még nedves az indigó. „BEKÉRÉS / HELYI JELÖLÉS: 09” olvasható rajta; a többi sor apró betűs.'), env('window', 'A túloldali olvasóra néző ablak', 'Az olvasóterem küszöbén keskeny lámpa világít. A közted és közte futó árokban mozdulatlan víz áll, de a lámpa tükörképe néha továbbhalad. A belső falon friss kéznyom látszik: nem éred el.'), env('tube-mouth', 'Csőposta nyílása', 'A cső pereme a füstszínű lemez félholdas végéhez hasonlóan ível, de jóval szélesebb annál. Belseje üres; a beküldött papír zizegése már elhalt. Itt nincs olyan foglalat, amely a lemezt megtartaná. A hasonló ív önmagában nem mutatja meg, mire való.'), env('bolt-holes', 'Négy csavarlyuk', 'A négy furat téglalapot alkot. Az egyik körül friss porgyűrű, a másik három mellett sötét lerakódás maradt. Közöttük nem kopott meg a padló: nem látszik rajta, hogy sokáig használták volna az egykori széket.')],
      exits: [exit('receiver-back', 'Vissza a küldeményfülkébe')],
      ...bindScene('relay:receiver-room'),
      rules: [look('reply', '„A KÉRELEM ÉS AZ ENGEDÉLY KÜLÖN LAP. EBBEN A HELYI MÁSOLATTÁRBAN CSAK ENGEDÉLYMÁSOLAT KERESHETŐ. EREDETI KÉRELEM: TÚLOLDALI OLVASÓ.” A csík a bekérésedre válaszol; nem nevezi meg az ébresztés elrendelőjét, és nem igazolja, hogy a 09 kizárólag hozzád tartozik. Az ablakon túl a megjelölt olvasóterem látszik, nem újabb archívumi polc.', { requires: phase(['request-sent']), addFlags: [id('received'), id('destination-known')], notes: ['A Fogadóállomás válasza külön kezeli az ébresztési kérelmet és az engedélyt. A helyi archívum engedélymásolatot őrizhet; az eredeti kérelem helyeként a túloldali olvasót jelöli meg.'], milestone: { id: id('received'), title: 'Nem ugyanaz a lap', text: 'Eljutottam az alsó Fogadóállomásra, és a pulton választ találtam a bekérésemre. A kérelem és az engedély két külön lap, állt rajta. A helyi másolattárban csak engedélymásolat kereshető; az eredeti kérelmet a túloldali olvasóhoz irányították. A válasz nem ígérte, hogy ott megértem az ébredésemet. De most már tudtam, milyen iratot keresek, és az ablakon túl láttam a következő helyét.' } }),
        { id: id('use:witness:tube'), label: 'Odaillesztem', kind: 'use', interaction: { verb: 'use', item: 'archive:witness', target: target('tube-mouth') }, message: 'A félholdas kivágás csak a cső peremének egy rövid szakaszát követi. A lemez megtartásához hiányzik a foglalat. Visszaveszed; a lyuksor olvasatlan marad.' }, move('receiver-back', id('dispatch-room'), 'A csőposta mögött tovább zizeg az indigó.'),
      ],
    },
  },
};

relay.scenes[id('well-room')].rules.find(rule => rule.id === id('look:ledge'))!.messageVariants = [{ requires: { items: [id('blank-seal')] }, text: 'A félrebillentett prés alatt üres a kerek mélyedés. A pecsétet már elvitted; csak fémforgács és a nyomólap fordított lépcsőjele maradt.' }];
for (const side of ['left', 'right']) {
  const entity = relay.scenes[id('well-room')].environment!.find(entity => entity.id === id(`${side}-wheel`))!;
  entity.descriptionVariants = [
    { requires: phase([`${side}-high`]), text: `A ${side === 'left' ? 'villa' : 'keresztgerenda'} a felső ütközőnél áll. A racsni tartja a kötelet; a következő fordítás az alsó jelhez engedi vissza.` },
    { requires: phase([`${side}-mid`]), text: `A ${side === 'left' ? 'villa' : 'keresztgerenda'} a középső ütközőnél áll. A kötél feszes; a következő fordítás a felső jelhez emeli.` },
    { requires: {}, text: `A ${side === 'left' ? 'villa' : 'keresztgerenda'} az alsó ütközőnél áll. A háromállású kézikerék egy fordítása a középső jelhez emeli.` },
  ];
}
relay.scenes[id('dispatch-room')].environment!.find(entity => entity.id === id('missing-tray'))!.descriptionVariants = [{ requires: phase(['request-sent']), text: 'A bekérőlap két számhelyén 09 áll; mellette az átvételi négyzet. A továbbított példány már nincs a vályúban. A névmező továbbra is hiányzik: nem kérték.' }];
relay.scenes[id('interval-room')].descriptionVariants = [
  { requires: phase(['rhythm-open']), text: 'A túlsó ajtó mindhárom retesze behúzódott; a rögzítőnyelv nyitva tartja az ajtót. A falon az ütőnyelv és a kettős villa, mellettük az üres foglalat feszes hártyája látszik. A porban ugyanazok a lábnyomok maradtak.' },
  { requires: phase(['beat-two']), text: 'Az ajtó bal és középső retesze behúzódott; a harmadik még zárva tartja az ajtót. A kettős villa egyre halkabban zeng, az üres foglalat hártyája megfeszül. A porban ugyanazok a lábnyomok maradtak.' },
  { requires: phase(['beat-one']), text: 'Az ajtó bal retesze behúzódott, a másik kettő a helyén maradt. A széles ütőnyelv még rezeg; mellette a kettős villa és az üres foglalat hártyája látszik. A porban ugyanazok a lábnyomok maradtak.' },
];
relay.scenes[id('well-room')].descriptionVariants = [];
const levelNames = ['alsó', 'középső', 'felső'];
const levelRequirement = (side: string, level: number) => level === 2 ? phase([`${side}-high`]) : level === 1 ? phase([`${side}-mid`], [`${side}-high`]) : phase([], [`${side}-mid`, `${side}-high`]);
for (const ready of [true, false]) for (let left = 0; left < 3; left++) for (let right = 0; right < 3; right++) {
  const a = levelRequirement('left', left), b = levelRequirement('right', right);
  const requires = { flags: [...a.flags!, ...b.flags!, ...(ready ? [id('lift-ready')] : [])], withoutFlags: [...a.withoutFlags!, ...b.withoutFlags!, ...(!ready ? [id('lift-ready')] : [])] };
  relay.scenes[id('well-room')].descriptionVariants!.push({ requires, text: `A háromágú villa a${left === 0 ? 'z' : ''} ${levelNames[left]} jelnél áll, a keresztgerenda pedig a${right === 0 ? 'z' : ''} ${levelNames[right]} jelnél. ${ready ? 'A felvonókosarat külön fék rögzíti a járdához. A kézikerekeket tovább forgathatod, ettől a fék nem old ki.' : 'A felvonókosár a járda alatt függ. A két kézikerékkel külön-külön állíthatod a köteleket.'} A falon, a KRETA felirat mellett továbbra is látszanak a lépcsőt formázó körvonalak.` });
}
for (const rule of relay.scenes[id('well-room')].rules.filter(rule => rule.kind === 'look' && rule.interaction?.target?.id === id('alignment'))) rule.messageVariants = [{ requires: phase(['lift-ready']), text: 'A felvonókosarat a járdánál a külön sínbe ült rögzítőfék tartja. A kötelek mostani helyzete már nem oldja vissza a féket; a krétán továbbra is a villa felső és a keresztgerenda középső körvonala találkozik.' }];
relay.scenes[id('dispatch-room')].descriptionVariants = [{ requires: phase(['request-sent']), text: 'A NÉV, JAVÍTÁS és HIÁNY tálca fölött megállt a másolókéz. Az indigós lapon a bekérés 09-es jelölése és az átvételi négyzet. A Fogadóállomás ajtaja nyitva áll.' }];
relay.scenes[id('dispatch-room')].rules.find(rule => rule.id === id('submit:missing'))!.messageVariants = [{ requires: phase(['request-sent']), text: 'A bekérés 09-es jelölése mellett már ott az átvételi négyzet. A másolatot továbbítottad; a Fogadóállomás ajtaja nyitva marad.' }];
relay.scenes[id('dispatch-room')].rules.find(rule => rule.id === id('use:missing-tray:press'))!.messageVariants = [{ requires: phase(['request-sent']), text: 'A tálca a már kitöltött bekérés másolatát tolja előre. A 09 mellett átvételi négyzet áll; személynév nincs a lapon.' }];

// The service route yields an actual record, not only another destination.
// The local document reference links these two copies; "09" alone never does.
const execution = 'Innen felnyithatod a kosár oldalán lévő, SZERVIZ IRAT feliratú tartót. A benne rögzített lap fejléce: „VÉGREHAJTÁS / HELYI 09 / E-09/1”. Alatta: „ÉBRESZTÉS VÉGREHAJTVA. BELSŐ ZÁR: VÁLTOZATLAN.” A kapcsolási rajzon az ébresztés jele és a belső kézi zár külön vezetéken fut. Ennél az ébresztésnél tehát nem nyitották ki és nem is zárták újra a belső zárat. A lap a végrehajtást rögzíti: a kérelmező neve és az engedély szövege nincs rajta. A másolatot a tartóban hagyod.';
const executionMilestone = { id: id('execution-read'), title: 'A zárhoz nem nyúlt', text: 'A felvonó oldalán felhozott irattartóban végrehajtási másolatot olvastam. E-09/1: ez volt a helyi irathivatkozása. Az ébresztést végrehajtották, a belső zár állását változatlanul hagyták. A jelút rajza is külön vezette a két műveletet. Legalább ennél a helyi ciklusnál az ébredés nem ugyanaz a művelet volt, mint a bezárás. Maga a végrehajtási lap nem idézte az engedélyt, és nem nevezte meg a kérelmezőt. A másolatot a tartóban hagytam.' };
const well = relay.scenes[id('well-room')], dispatch = relay.scenes[id('dispatch-room')], receiver = relay.scenes[id('receiver-room')];
const holder = 'A kosár oldalára szegecselt keskeny tartón SZERVIZ IRAT olvasható. A tartó a kosárral együtt mozog; nem ellensúly, a két kézikerékkel nem ezt állítod.';
well.environment!.push({ ...env('service-holder', 'A kosár szerviz-irattartója', holder + ' A járda alatt áll, innen a fedelét nem éred el.'), descriptionVariants: [{ requires: phase(['lift-ready']), text: holder + ' A kosár a járdához rögzítve vár. A tartó fedele az alsó küldeményfülke felől nyitható; felirata onnan is követhető.' }] });
well.arrivalDiscoveries!.push(id('service-holder'));
well.description += ' A kosár oldalára SZERVIZ IRAT feliratú tartót szegecseltek.';
for (const variant of well.descriptionVariants!) variant.text += ' A SZERVIZ IRAT tartó a kosár oldalán maradt.';
dispatch.environment!.push(env('execution-copy', 'Végrehajtási másolat az irattartóban', execution));
dispatch.arrivalDiscoveries!.push(id('execution-copy'));
dispatch.description += ' ' + execution;
for (const variant of dispatch.descriptionVariants!) variant.text += ' ' + execution;
dispatch.rules.push(look('execution-copy', execution, { addFlags: [id('execution-read')], milestone: executionMilestone }));
const enterDispatch = well.rules.find(rule => rule.id === id('move:dispatch'))!;
enterDispatch.message += ' ' + execution;
enterDispatch.addFlags = [id('execution-read')];
enterDispatch.milestone = executionMilestone;
enterDispatch.messageVariants = [{ requires: phase(['execution-read']), text: 'Leereszkedsz a küldeményfülkéhez. A kosár oldalsó tartójában változatlanul az E-09/1 végrehajtási másolata áll: ébresztés végrehajtva, belső zár változatlan.' }];

const permit = 'A válaszcsík mellett külön lapot tart egy kapocs. A fejléce: „ENGEDÉLYKIVONAT / HELYI 09 / E-09/1”. Alatta: „ÉBRESZTÉS ENGEDÉLYEZVE. A BELSŐ ZÁR ÖNÁLLÓ KEZELÉSE VÁLTOZATLAN.” Az E-09/1 az irat helyi hivatkozási száma. Ez még nem az eredeti kérelem, de az engedélyből már elolvashatsz egy részletet: ébresztésről szól, a belső zár külön kezelését változatlanul hagyja. Bezárásra vagy emléktörlésre ez a kivonat nem ad felhatalmazást. Azt nem tudod meg belőle, ki nyújtotta be a kérelmet, vagy vannak-e más iratok is.';
const permitMilestone = { id: id('permit-read'), title: 'Amit ez a lap engedett', text: 'A válaszcsík mellett külön engedélykivonatot olvastam. E-09/1 szerepelt rajta helyi irathivatkozásként. Ébresztést engedélyezett; a belső zár önálló kezelését meghagyta. A látott kivonatban nem szerepelt bezárásra vagy emléktörlésre szóló felhatalmazás. Az eredeti kérelmet továbbra sem láttam, és nem tudtam, ki adta be. De ez a lap már külön kezelte az ébresztést és a belső zárat: az egyikre engedélyt adott, a másik kezelését változatlanul hagyta.' };
receiver.environment!.push(env('permit-copy', 'Az ébresztési engedély kivonata', permit));
receiver.arrivalDiscoveries!.push(id('permit-copy'), id('card-reader'), id('accompanying-copy'));
receiver.description += ' ' + permit;
receiver.rules.push(look('permit-copy', permit, { addFlags: [id('permit-read')], milestone: permitMilestone }));
const enterReceiver = dispatch.rules.find(rule => rule.id === id('move:receiver'))!;
enterReceiver.message += ' ' + permit;
enterReceiver.addFlags = [id('permit-read')];
enterReceiver.milestone = permitMilestone;
enterReceiver.messageVariants = [{ requires: phase(['permit-read']), text: 'A Fogadóállomás pultján a válaszcsík mellett megmaradt az E-09/1 engedélykivonata. Ébresztést engedélyez, a belső zár kezelését külön hagyja; a túloldali olvasó ajtaján nem változott semmi.' }];
const receiverCopy = 'Az archívumból érkezett lapon KÍSÉRŐPÉLDÁNY felirat áll. Külön rovatba került, hogy most továbbindultál; a RÉGI HOZZÁJÁRULÁS rovata üres maradt. A mechanikus kéz csak a mostani bejegyzés mellé nyomott átvételi jelet, a régi beleegyezés helyére nem.';
const receiverCopyVariants = [
  { requires: { flags: ['awakening:departure-reserved'] }, text: receiverCopy + ' „FENNTARTÁS CSATOLVA: A KORÁBBI ÖNKÉNTESSÉGET NEM IGAZOLOM.” A külön megőrzött megjegyzést az archívumi kísérőmásolatból vették át. Az engedélykivonatot ennek ellenére kiadták.' },
  { requires: { flags: ['awakening:departure-plain'] }, text: receiverCopy + ' „JELENLEGI TOVÁBBHALADÁS” áll az átvett rovatban. A régi hozzájárulást nem pótolták vele; az engedélykivonat ugyanúgy hozzáférhető.' },
];
const receiverLegacy = receiverCopy + ' A megjegyzés helyén ez áll: „MEGJEGYZÉS NINCS CSATOLVA”. Nem írtak be helyetted semmilyen döntést; a kivonatot így is elolvashatod.';
receiver.environment!.push({ ...env('accompanying-copy', 'A fogadói kísérőpéldány', receiverLegacy), descriptionVariants: receiverCopyVariants });
receiver.rules.push(look('accompanying-copy', receiverLegacy, { messageVariants: receiverCopyVariants }));
receiver.description += ' A kísérőpéldány a mostani bejegyzést és a hiányzó régi hozzájárulást külön rovatban tartja.';

const cardReader = 'A csőpostától távolabb, a pulton külön OLVASÓ áll. Keskeny vezetősínje félholdas kivágásban végződik. Mellette három sűrű fogcsoport és egy különálló érintkező látszik. A foglalat üres, alatta papírkiadó rés nyílik. A lemeznek itt lehet helye, nem a csőpostában.';
const witnessRead = 'A lemez félholdas vége a vezetősín ütközőjéhez ér. A három lyukcsoport és a különálló lyuk alatt felvillannak az érintkezők. Az olvasó papírcsíkot nyomtat: „ÁTVÉTEL / E-09/1 / ENGEDÉLY ÉS VÉGREHAJTÁS ELLENPÉLDÁNYA. KÉRELEM NÉLKÜL: CSAK KIVONAT ADHATÓ KI.” A csík az iratpárra hivatkozik, nem valakinek a vallomását tartalmazza. A két irat külön helyen van: az engedélykivonat itt, a válaszcsík mellett, a végrehajtási másolat pedig a küldeményfülkénél, a kosár irattartójában. Az eredeti kérelmet még nem mutattad be, ezért csak kivonatot adnak ki. A lemezt az olvasó foglalatában hagyod, a papírcsík a kimeneti résben marad.';
receiver.environment!.push({ ...env('card-reader', 'Asztali lyuksorolvasó', cardReader), descriptionVariants: [
  { requires: { flags: [id('witness-read')], withoutItems: ['archive:witness'] }, text: 'Az OLVASÓ félholdas foglalatában ott a lemez. A kimeneti résben megmaradt az „ÁTVÉTEL / E-09/1” csík: az engedély és a végrehajtás ellenpéldánya, eredeti kérelem nélkül csak kivonat adható ki. A csík nem nevez meg személyt.' },
  { requires: phase(['witness-read']), text: 'Az OLVASÓ félholdas foglalata üres; a lemezt visszavetted. A kimeneti résben megmaradt az „ÁTVÉTEL / E-09/1” csík: az engedély és a végrehajtás ellenpéldánya, eredeti kérelem nélkül csak kivonat adható ki. A csík nem nevez meg személyt.' },
] });
receiver.description += ' A csőpostától külön asztali lyuksorolvasó áll, üres félholdas foglalattal.';
receiver.rules.push({ id: id('use:witness:reader'), label: 'Használom', kind: 'use', interaction: { verb: 'use', item: 'archive:witness', target: target('card-reader') }, addFlags: [id('witness-read')], removeItems: ['archive:witness'], message: witnessRead, milestone: { id: id('witness-read'), title: 'A tanúpéldány megszólalt', text: 'A füstszínű lemez végre illett egy olvasóba. Nem a csőposta pereméhez: a pulton külön félholdas foglalat várta. A lyuksor az E-09/1 engedély és végrehajtás átvételi ellenpéldányát adta ki. Ugyanarra a helyi iratpárra hivatkozott, mint a papírok, de nem volt személyes vallomás, és nem pótolta az eredeti kérelmet. Az átadás korlátját is rögzítette: kérelem nélkül csak kivonat adható ki. A lemezt az olvasó foglalatában hagytam.' } });
// The old reply remains true and its book page is immutable; the new separate
// object is visible beside it, rather than another promise to find a reader.
receiver.rules.find(rule => rule.id === id('look:reply'))!.message += ' A válaszcsík mellett már ott van a külön E-09/1 engedélykivonat is; az eredeti kérelem helyét nem változtatja meg.';
const receiverBase = 'Az ablak az árok túloldali olvasótermére néz. A régi válaszcsík és a csőposta a pulton maradt. ';
receiver.rules.find(rule => rule.id === id('use:witness:reader'))!.milestone!.text = 'A füstszínű lemezt a pult külön félholdas foglalatába illesztettem. A lyuksor az E-09/1 engedély és végrehajtás átvételi ellenpéldányát adta ki: a nyomtatott csík maga nevezte meg az iratpárt és a hivatkozását. Nem személyes vallomás volt, és nem pótolta az eredeti kérelmet. Az átadás korlátját is rögzítette: kérelem nélkül csak kivonat adható ki. A papírok külön helyen vizsgálhatók: az engedélykivonat a fogadói pulton, a végrehajtási másolat a küldeményfülke kosarának tartójában. A lemezt az olvasó foglalatában hagytam.';
const readerEmpty = ' Az asztali OLVASÓ félholdas foglalata és kimeneti rése üres.';
const readerPrinted = ' Az asztali OLVASÓ foglalatában ott a lemez; kimenetében az ÁTVÉTEL / E-09/1 csík maradt.';
// The socket prose follows what actually happened to the plate: it is called left
// behind only when it is really gone. A save made before that change still carries
// the plate, so its examination must keep saying so.
const readerReturned = ' Az asztali OLVASÓ foglalata üres; a lemezt visszavetted. Kimenetében az ÁTVÉTEL / E-09/1 csík maradt.';
const readerStates: { requires: Requirement; text: string }[] = [
  { requires: { withoutFlags: [id('witness-read')] }, text: readerEmpty },
  { requires: { flags: [id('witness-read')], withoutItems: ['archive:witness'] }, text: readerPrinted },
  { requires: { flags: [id('witness-read')], items: ['archive:witness'] }, text: readerReturned },
];
receiver.description = receiverBase + permit + ' ' + receiverLegacy + readerEmpty;
receiver.descriptionVariants = readerStates.flatMap(state => {
  const merged = (base: Requirement): Requirement => ({
    ...base,
    flags: [...base.flags ?? [], ...state.requires.flags ?? []],
    withoutFlags: [...base.withoutFlags ?? [], ...state.requires.withoutFlags ?? []],
    ...(state.requires.items ? { items: state.requires.items } : {}),
    ...(state.requires.withoutItems ? { withoutItems: state.requires.withoutItems } : {}),
  });
  return [
    ...receiverCopyVariants.map(variant => ({ requires: merged(variant.requires), text: receiverBase + permit + ' ' + variant.text + state.text })),
    { requires: merged({ withoutFlags: ['awakening:departure-reserved', 'awakening:departure-plain'] }), text: receiverBase + permit + ' ' + receiverLegacy + state.text },
  ];
});
