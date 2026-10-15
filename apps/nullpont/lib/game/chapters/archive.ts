import type { Chapter, Requirement, Rule } from '../types.ts';
import { bindScene, itemArts } from '../presentation/index.ts';

const id = (name: string) => `archive:${name}`;
const target = (name: string) => ({ kind: 'environment' as const, id: id(name) });
const look = (name: string, message: string, extra: Partial<Rule> = {}): Rule => ({
  id: id(`look:${name}`), label: 'Megvizsgálom', kind: 'look', interaction: { verb: 'look', target: target(name) },
  requires: { discoveries: [id(name)] }, message, ...extra,
});
const move = (exit: string, room: string, message: string, requires?: Requirement): Rule => ({
  id: id(`move:${exit}`), label: 'Továbbmegyek', kind: 'move',
  interaction: { verb: 'move', target: { kind: 'exit', id: id(exit) } }, moveTo: room, message, requires,
});
const env = (name: string, label: string, description: string, requires?: Requirement) => ({ id: id(name), label, description, requires });
const exit = (name: string, label: string) => ({ id: id(name), label });
const selector = (name: string, value: string, message: string, addFlags: string[], removeFlags: string[]): Rule => ({
  id: id(`submit:${name}:${value}`), label: 'Átállítom', kind: 'submit',
  interaction: { verb: 'submit', target: target(name), input: value },
  requires: { discoveries: [id(name)] }, message, addFlags: addFlags.map(id), removeFlags: removeFlags.map(id),
});

export const archive: Chapter = {
  id: 'archive', title: 'II. A címek közötti csend',
  items: { 'archive:witness': 'Füstszínű, lyukasztott lemez' },
  itemDescriptions: { 'archive:witness': 'Keskeny, füstszínű lemez, egyik végén félhold alakú kivágással. Három sűrű lyukcsoportot egyetlen különálló lyuk követ. A hátoldalán: „TANÚPÉLDÁNY / HELYBEN NEM OLVASHATÓ”. Ez a lemezre nyomtatott elnevezés; a rendeltetését nem magyarázza meg. A széle simára kopott, mintha sokáig hordták volna zsebben.' },
  itemArt: itemArts(['archive:witness']),
  connections: [{
    from: 'threshold', exits: [exit('entry', 'A keskeny oldalsó átjáró')],
    artSpots: bindScene('connection:archive:entry').artSpots,
    rules: [{ ...move('entry', id('vestibule'), 'Az ablak melletti keskeny átjáró alacsony előcsarnokba vezet. Itt már nem hideg a levegő: papír és felhevült por szaga van.'),
      requires: { flags: ['awakening:chapter-closed'] },
      milestone: { id: id('arrival'), title: 'A papír szaga', text: 'Az üveg mögötti betűk mellett egy oldalsó átjárót találtam. Az előcsarnokban por melegedett egy lámpa alatt. Az archívum nem puszta felirat volt a folyosó ablakán: be lehetett lépni, meg lehetett érinteni a bútorait. A bejárat melletti széken két különböző mélységű horpadás maradt.' } },
      { ...move('entry', id('vestibule'), 'Az oldalsó átjáró beléptetője még zárva van. A kijárati pultnál kérhetsz hozzáférést; az ablak alatti útjelző a gépház mellékajtójához vezet. Ott az iratellenőrzőn át jutsz a pulthoz. Az ébresztőszoba ajtaja nyitva marad.', { withoutFlags: ['awakening:chapter-closed'] }), id: id('move:entry:awaiting-departure'), moveTo: undefined }],
  }],
  scenes: {
    'archive:vestibule': {
      title: '03 · Az iktató előcsarnoka', description: 'Az irattár előterében címjegyzék segíti a tájékozódást. Alacsony lámpa világít rá és a lezárt irattári ajtó keskeny számlapjára. Balra a körfolyosóra térhetsz vissza. Az irattári ajtótól jobbra keskeny rácsos járda vezet a megfigyelőhídra. Alatta külön, JELFÜLKE feliratú lépcsőlejáró vezet a jelosztóhoz. Egy rögzített szék ülőlapján két egymásba csúszó horpadás látszik.',
      arrivalDiscoveries: [id('board'), id('reader'), id('chair')],
      environment: [env('board', 'Falitábla', 'A falitábla alatt hosszú, tiszta csík maradt a porban. Valaki nemrég kihúzott innen egy lapot.'), env('reader', 'Irattári számlap', 'Három üres számhely. A keretbe három jel van vésve: kör, kettős vonal, háromszög. A jelek balról jobbra követik egymást. A számlap alatt: „HELYI SZEMLE”.'), env('chair', 'Horpadásos szék', 'A széket a padlóhoz csavarozták. A széles horpadásban egy keskenyebb ülőhely nyoma fekszik, de a két benyomódás között nincs repedés. Az egyik első láb körül friss porgyűrű látszik; a többi láb mellett régi, sötét lerakódás.')],
      inputs: [{ id: id('reader'), label: 'Számlap', prompt: 'Három számhely', maxLength: 3, format: 'digits' }],
      exits: [exit('threshold', 'Vissza a körfolyosóra'), exit('bridge', 'A megfigyelőhídra'), exit('signals', 'Le a jelosztófülkébe'), exit('records', 'Az irattárba')],
      ...bindScene('archive:vestibule'),
      rules: [
        look('board', 'A táblán csúszó sín tartja a címjegyzéket. A fejléc alatti számsor nem dátum: két oszlop fut párhuzamosan, BELÜL és FOLYOSÓ felirattal.', { focusTo: id('directory') }),
        look('reader', 'A számlap üvege alatt három különálló dob vár. Alattuk: „HELYI SZEMLE”. Kör, kettős vonal, háromszög: ugyanezek a jelek a híd felé futó kábelre is rá vannak festve. Az irattári ajtó felől gyenge papírzizegés hallatszik.'),
        { id: id('submit:reader'), label: 'Beállítom a számlapot', kind: 'submit', interaction: { verb: 'submit', target: target('reader'), input: '427' }, requires: { discoveries: [id('reader')] }, addFlags: [id('records-open')], message: 'A három dob egyszerre kattan. A kilincs leereszkedik, a túloldalon valami vékony nekicsúszik az ajtónak.' },
        move('threshold', 'threshold', 'Újra hallod a tizenkét ajtó mögül érkező, egymástól elcsúszó hangokat.'),
        move('bridge', id('bridge-room'), 'A híd keskeny rácspadlója alatt lassan kúsznak a betűk. A korlát meleg.'),
        move('signals', id('signal-room'), 'Három lépcsővel lejjebb eltűnik a folyosó visszhangja. A kábelek zúgását a fogadban érzed.'),
        move('records', id('record-room'), 'A megnyílt ajtó mögött iratok lógnak a síneken, nem polcokon.', { flags: [id('records-open')] }),
        { ...move('records', id('record-room'), 'A kilincs egy ujjnyit enged, aztán megáll. A számlap dobjai külön-külön halkan rezegnek.', { withoutFlags: [id('records-open')] }), id: id('move:records:closed'), moveTo: undefined },
      ],
    },
    'archive:directory': {
      detailOf: id('vestibule'), title: 'A falitábla · címjegyzék', description: 'Két címrendszer sorai ugyanazon a sínen. A kilencedik sor mellé keskeny papírcsíkot szorítottak.',
      arrivalDiscoveries: [id('addresses'), id('margin')],
      environment: [env('addresses', 'Páros címek', 'BELÜL 07 — FOLYOSÓ 70. BELÜL 08 — FOLYOSÓ 80. BELÜL 09 — FOLYOSÓ 90. A számok nem tükörképként vannak nyomtatva: külön fémcímkék, külön oszlopban. A fejléc: „KETTŐS CÍMZÉS / HELYI ÁTJÁRÓK”.'), env('margin', 'Beszorított papírcsík', 'A kilencedik sor alá hajtott csík széle áttetsző. Nyomtatott szavak és egy ceruzavonal ütnek át rajta.')],
      ...bindScene('archive:directory'),
      rules: [look('addresses', 'A 09 és a 90 ugyanazon a soron áll: BELÜL 09 — FOLYOSÓ 90. A fejléc kettős címzésnek nevezi. Nem két szobát találtál, hanem ugyanannak az átjárónak két helyi címét. A tábláról nem derül ki, miért fordítják meg a számokat.', { notes: ['A helyi címjegyzék egy sorban párosítja a belső 09-et és a folyosói 90-et; az eltérő számozás célját nem magyarázza.'], milestone: { id: id('addresses-read'), title: 'Ugyanannak az ajtónak két címe', text: 'A falitáblán egymás mellé került a két szám, amely az ajtómon zavart: belül 09, a folyosón 90. A többi átjárónál is két külön cím szerepelt. Legalább ezt nem az emlékezetem tévesztette össze. Aki a táblát készítette, szándékosan tartotta fenn mindkettőt. Az okát nem írta oda.' } }),
        look('margin', 'Kihajtod a vékony csíkot. „CÍMVÁLTÁS NEM SZEMÉLYVÁLTÁS” – áll rajta. Alatta ceruzával: „A széket ne cseréljék ki.” A papír hátulján egy sötét réteg válik el a rostoktól.', { focusTo: id('paper-fold') })],
    },
    'archive:paper-fold': {
      detailOf: id('directory'), title: 'A falitábla · a papírcsík hátoldala', description: 'A kihajtott csík mögött vékony füstszínű lemez lapul. A ceruzavonal a papíron két alkalommal futott végig: az egyik húzás sokkal halványabb.',
      arrivalDiscoveries: [id('pencil')],
      environment: [env('pencil', 'Kettős ceruzavonal', 'A sötét vonal a szék szót húzza alá. A halványabb ugyanott kezdődik, de a végén eltéved: egy apró, üres négyszöget rajzol a margóra. A papíron nincs név vagy aláírás.'), env('loose-witness', 'Füstszínű lemez', 'A papír mögé csúsztatott lemeznek félholdas a vége. A lyukak körül finom, fehér perem látszik. A hátoldalán: „TANÚPÉLDÁNY / HELYBEN NEM OLVASHATÓ”. Ebből még nem derül ki, milyen olvasóhoz készült.', { withoutItems: [id('witness')] })],
      ...bindScene('archive:paper-fold'),
      rules: [look('pencil', 'A ceruzavonal mellett ragasztó helyett két kis bemetszés fogott közre egy lapos lemezt. A félholdas vég kilóg a papír alól.', { discover: [id('loose-witness')] }),
        { id: id('take:witness'), label: 'Felveszem', kind: 'take', interaction: { verb: 'take', target: target('loose-witness') }, requires: { discoveries: [id('loose-witness')], withoutItems: [id('witness')] }, addItems: [id('witness')], message: 'A lemez könnyedén kicsúszik a bemetszésekből. A hátoldalán tisztán kivehető: „TANÚPÉLDÁNY / HELYBEN NEM OLVASHATÓ”. A papír visszahajlik az üres helyére.', notes: ['Füstszínű, lyukasztott lemezt találtam a címjegyzék mögött. A hátoldala „tanúpéldánynak” nevezi; a rendeltetése még nem világos.'] }],
    },
    'archive:bridge-room': {
      title: '04 · A megfigyelőhíd', description: 'Az üvegfal melletti rácsos járdáról az alant mozgó betűket figyelheted. Három kivilágított jelző az irattári ajtó számlapjához csatlakozik. A korlát végén külön olvasószerkezet áll: üvegbúrája alatt keskeny papírcsík remeg két érintkező között. A hozzá futó kábelek a jelosztófülkébe vezetnek.',
      arrivalDiscoveries: [id('gauges'), id('glass'), id('tongue')],
      environment: [env('gauges', 'Három szemlejelző', 'A három jelző külön kábelből kap fényt. A foglalatokra kört, kettős vonalat és háromszöget festettek; a számaik nem változnak a betűk mozgásával.'), env('glass', 'Betűk az üveg alatt', 'A mélységet nem lehet felmérni. Egy N betű végigcsúszik az üvegen, a lába mögött árnyék helyett egy kisebb n marad. Amikor rátartod a kezedet, mindkettő eltávolodik, de nem ugyanabba az irányba.'), env('tongue', 'Papírnyelv az üvegbúrában', 'A papírnyelv két rézérintkező között leng. A búrán: „OLVASÁS / KÜLSŐ HÍDÁG”. Alatta két lámpa: útvonal és földelés. A gépezet nem a rácspadlót mozgatja, hanem valamit a papír körül.')],
      exits: [exit('bridge-return', 'Vissza az iktatóhoz')],
      ...bindScene('archive:bridge-room'),
      rules: [look('gauges', 'A kör foglalatában 4 áll, a kettős vonalnál 2, a háromszögnél 7. Mindhárom számot a burkolat alá karcolták; a fény csak megvilágítja őket. A közös kábel visszafut az iktató számlapjához.', { notes: ['A híd szemlejelzőin: kör — 4; kettős vonal — 2; háromszög — 7.'] }),
        look('tongue', 'A búrán: „OLVASÁS / KÜLSŐ HÍDÁG”. A papírnyelv össze-vissza rebben, a rézérintkezők között nem ér át semmi. Az útvonal- és földelésjelző közül legalább az egyik sötét.', { requires: { discoveries: [id('tongue')], withoutFlags: [id('route-bridge')] } }),
        { ...look('tongue', 'A búrán: „OLVASÁS / KÜLSŐ HÍDÁG”. Az útvonallámpa világít, de a papír körül apró szikrák ugranak a belső érintkezőre. A földelésjelző sötét.', { requires: { discoveries: [id('tongue')], flags: [id('route-bridge')], withoutFlags: [id('ground-outer')] } }), id: id('look:tongue:ungrounded') },
        { ...look('tongue', 'A búrán: „OLVASÁS / KÜLSŐ HÍDÁG”. Mindkét lámpa felgyullad. A papírnyelv kisimul a búrában: „ÁTVÉTEL MEGTAGADVA / TANÚ HIÁNYZIK”. A sor alá egy második, keskenyebb sor nyomódik, de a tinta felét visszaszívja a papír. Csak ennyi marad: „…nem ugyanaz kérte.” A lemezolvasó helye üres: a búra mellett lezárt kábelcsonk lóg.', { requires: { discoveries: [id('tongue')], flags: [id('route-bridge'), id('ground-outer')] }, notes: ['A híd olvashatóvá vált jelzése átvételi megtagadásról és hiányzó tanúról szól. Egy hiányos második sor: „…nem ugyanaz kérte.”'], milestone: { id: id('signal-read'), title: 'A tinta visszahúzódott', text: 'A jelosztó útvonalai végül csendes fényt adtak az üvegbúrában. A papíron átvételi megtagadás állt, egy hiányzó tanú miatt. Nem szerepelt rajta, ki adott volna át mit. Aztán megjelent egy második sor, és majdnem azonnal eltűnt. A maradék szavakat magammal vittem: „nem ugyanaz kérte”. Nem tudtam, minek a kérelméről beszél a papír. A tinta úgy húzódott vissza, mintha ő is meggondolta volna magát.' } }), id: id('look:tongue:readable') },
        move('bridge-return', id('vestibule'), 'A rácspadló zengése az előcsarnok küszöbén elhal.')],
    },
    'archive:signal-room': {
      title: '05 · A jelosztófülke', description: 'A fülkéből ágaznak szét az archívum kábelei. A porcelánlapra szerelt két váltókapcsoló közül az egyik a híd és az irattár között kapcsolja át a jelet, a másik a földelést váltja. A kábelek feliratai a megfigyelőhíd üvegbúrájához vezetnek. A sarokban sárgaréz beszédcső nyílik a falba.',
      arrivalDiscoveries: [id('route'), id('ground'), id('tube')],
      environment: [env('route', 'Útvonalváltó', 'A porcelánkapcsoló két állásának felirata HID és TAR. Az első kábel a rácspadló alá fut, a második a mennyezetben tűnik el. A feliratokat valaki utánavéste, mert az eredeti festék lekopott.'), env('ground', 'Földelésváltó', 'A második kapcsoló jelölése KULSO és BELSO. A külső kábel az üvegfal pereméhez vezet. A belső sötétebb, szövettel burkolt; apró rezgéseket ad át a porcelánnak.'), env('tube', 'Sárgaréz beszédcső', 'A cső belsején páracseppek ülnek, bár a fülke száraz. A perem nem hangszórórács: nyitott cső fordul bele a falba. A saját lélegzeted csak későn ér vissza.')],
      inputs: [{ id: id('route'), label: 'Útvonal', prompt: 'A kapcsoló felirata', maxLength: 3, format: 'text' }, { id: id('ground'), label: 'Földelés', prompt: 'A kapcsoló felirata', maxLength: 5, format: 'text' }],
      topics: [{ id: id('tube-place'), label: 'Ki van a cső végén?', target: id('tube') }, { id: id('tube-name'), label: 'A nevedről kérdezem', target: id('tube') }, { id: id('tube-paper'), label: 'A papírról kérdezem', target: id('tube'), requires: { flags: [id('signal-read-heard')] } }],
      exits: [exit('signals-return', 'Fel az iktatóhoz')],
      ...bindScene('archive:signal-room'),
      rules: [
        look('route', 'A váltó a TAR ágon áll. A rácspadlóhoz vezető vezeték csendes.', { requires: { discoveries: [id('route')], withoutFlags: [id('route-bridge')] } }),
        { ...look('route', 'A váltó a HID ágon áll. A rácspadló felé futó kábelben magas hang zeng.', { requires: { discoveries: [id('route')], flags: [id('route-bridge')] } }), id: id('look:route:bridge') },
        look('ground', 'A földelés a BELSO ágra csatlakozik. A szövetburkolat ritmusosan megfeszül.', { requires: { discoveries: [id('ground')], withoutFlags: [id('ground-outer')] } }),
        { ...look('ground', 'A földelés a KULSO ágra csatlakozik. Az üvegfal peremén vékony kék fény fut végig.', { requires: { discoveries: [id('ground')], flags: [id('ground-outer')] } }), id: id('look:ground:outer') },
        selector('route', 'HID', 'A kapcsoló a híd felé fordul; az eddigi mély búgás helyére vékony sípszó lép.', ['route-bridge'], []),
        selector('route', 'TAR', 'A kapcsoló az irattári ág felé fordul. A mennyezetben két rövid kattanás felel.', [], ['route-bridge']),
        selector('ground', 'KULSO', 'A külső kábel megfeszül, az üveg felől hosszú, tiszta pendülés hallatszik.', ['ground-outer'], []),
        selector('ground', 'BELSO', 'A belső kábel visszaveszi a terhelést. A porcelánlapon apró porszemek mozdulnak.', [], ['ground-outer']),
        { id: id('talk:tube'), label: 'Megszólítom', kind: 'talk', interaction: { verb: 'talk', target: target('tube') }, requires: { discoveries: [id('tube')] }, message: '„Azt hittem, a széket hozod” – mondja egy rekedt hang. A cső mélyén papír súrlódik. „Mindig az marad itt a legtovább.”', addFlags: [id('tube-heard')] },
        { id: id('talk:tube-place'), label: 'Kérdezek', kind: 'talk', interaction: { verb: 'talk', target: target('tube'), topic: id('tube-place') }, message: '„A cső másik végén” – felel a hang. „Ez a pontos helymeghatározás. A többit a táblán keresd.” A csőben egy kanál csörren, vagy valami nagyon hasonló.' },
        { id: id('talk:tube-name'), label: 'Kérdezek', kind: 'talk', interaction: { verb: 'talk', target: target('tube'), topic: id('tube-name') }, message: '„Most? Másoló.” A szó után hosszú lélegzetvétel hallatszik. „Nem azt kérdezted, mióta.”' },
        { id: id('talk:tube-paper'), label: 'Kérdezek', kind: 'talk', interaction: { verb: 'talk', target: target('tube'), topic: id('tube-paper') }, requires: { flags: [id('signal-read-heard')] }, message: '„A betű nem érkezik meg attól, hogy átjön a csövön. Valakinek át is kell vennie.” A hang halkabb lesz. „Én csak másolok. Legalábbis a munkalapomon ez áll.”' },
        { id: id('attack:tube'), label: 'Megütöm', kind: 'attack', interaction: { verb: 'attack', target: target('tube') }, message: 'A sárgaréz mélyen kong. A cső túloldalán valaki háromszor visszakopog, egyre halkabban. A negyedik koppanás már a padló alól jön.' },
        move('signals-return', id('vestibule'), 'A fülke zúgása mögötted marad. A lámpa alatti por ugyanúgy lebeg, mint az imént.')],
    },
    'archive:record-room': {
      title: '06 · A függő irattár', description: 'Papírlapok lógnak mennyezeti síneken. Nem időrendben követik egymást: üres helyek váltakoznak vastag iratcsomókkal. A falnál egy munkalap fekszik egy elnémult csengő mellett.',
      arrivalDiscoveries: [id('work-sheet'), id('hanging'), id('bell')],
      environment: [env('work-sheet', 'Átviteli munkalap', 'A munkalap szélén a megfigyelőhíd búrájának metszete látszik. A kábelrajzon két vonal keresztezi egymást, de a keresztezésnél nincs csomópont.'), env('hanging', 'Függő iratok', 'Az egyik csomó minden lapja üres, mégis külön iktatószámuk van. A szomszédos üres hely alatt friss papírpor fekszik. A sínen nem tépésnyom látszik: a függesztőkapcsot nyitották ki.'), env('bell', 'Néma csengő', 'A csengő nyelve helyére fehér zsinórt kötöttek. A zsinór átmegy a falon, de húzásra csak a munkalap sarka emelkedik meg. A csengő belső felén kézzel írt szó: „MÉG”.')],
      exits: [exit('records-return', 'Vissza az iktatóhoz')],
      ...bindScene('archive:record-room'),
      rules: [look('work-sheet', 'Az átviteli rajzon a HID ág a papírnyelvhez fut, a TAR ág egy sötét téglalapba. A papírnyelv körül csak a KULSO érintkező van tisztára rajzolva; a BELSO mellett fekete pontsor áll. Az alsó megjegyzés: „BELSŐ TERHELÉS MELLETT A SOR VISSZAHÚZÓDIK.” Nincs rajta személynév.', { notes: ['A munkalap a hídág papírnyelvét és a külső érintkezőt rajzolja tisztán. Belső terhelésnél a sor visszahúzódik.'], addFlags: [id('signal-read-heard')] }),
        move('records-return', id('vestibule'), 'A függő lapok még ringanak egy kicsit, amikor kilépsz.')],
    },
  },
};

const witnessTaken = { items: [id('witness')] };
archive.scenes[id('paper-fold')].descriptionVariants = [{ requires: witnessTaken, text: 'A kihajtott papírcsík mögött üres a lemez helye. A két bemetszés és a kettős ceruzavonal megmaradt.' }];
archive.scenes[id('paper-fold')].rules.find(rule => rule.id === id('look:pencil'))!.messageVariants = [{ requires: witnessTaken, text: 'A ceruzavonal mellett két üres bemetszés látszik. Innen csúsztattad ki a füstszínű lemezt; a félholdas vég már nem lóg a papír alól.' }];
archive.scenes[id('directory')].rules.find(rule => rule.id === id('look:margin'))!.messageVariants = [{ requires: witnessTaken, text: 'Újra kihajtod a csíkot: „CÍMVÁLTÁS NEM SZEMÉLYVÁLTÁS”. Alatta: „A széket ne cseréljék ki.” A hátoldali bemetszések üresek; a lemezt már kivetted.' }];
archive.scenes[id('vestibule')].descriptionVariants = [{ requires: { flags: [id('records-open')] }, text: 'A lámpa a falitáblára és a beállított számlapra világít. Az irattári ajtó nyitva áll. Balra a körfolyosóra térhetsz vissza; az irattári ajtótól jobbra rácsos járda vezet a megfigyelőhídra. Alatta külön, JELFÜLKE feliratú lépcsőlejáró nyílik. A széken két egymásba csúszó horpadás.' }];
archive.scenes[id('vestibule')].rules.find(rule => rule.id === id('look:reader'))!.messageVariants = [{ requires: { flags: [id('records-open')] }, text: 'A három dob a beállított számokat mutatja. Alattuk továbbra is: „HELYI SZEMLE”. A kör, kettős vonal és háromszög változatlanul a keretbe van vésve. Az irattári ajtó zárja már elengedett.' }];
archive.scenes[id('vestibule')].rules.find(rule => rule.id === id('submit:reader'))!.messageVariants = [{ requires: { flags: [id('records-open')] }, text: 'A dobok ugyanabba az állásba kattanak vissza. Az irattári ajtó már nyitva áll; a kilincs lent marad.' }];
