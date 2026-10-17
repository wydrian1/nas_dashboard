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

// Persistent pickup plus legacy evidence: inventory absence alone cannot mean
// the plate is back here after it was left in the later reader.
const witnessTaken = [{ items: [id('witness')] }, { flags: [id('witness-taken')] }, { flags: ['relay:witness-read'] }];
const witnessAvailable = { withoutItems: [id('witness')], withoutFlags: [id('witness-taken'), 'relay:witness-read'] };
archive.scenes[id('paper-fold')].environment!.find(entity=>entity.id===id('loose-witness'))!.requires = witnessAvailable;
const takeWitness = archive.scenes[id('paper-fold')].rules.find(rule=>rule.id===id('take:witness'))!;
takeWitness.requires = { ...takeWitness.requires, ...witnessAvailable };
takeWitness.addFlags = [id('witness-taken')];
archive.scenes[id('paper-fold')].descriptionVariants = witnessTaken.map(requires=>({ requires, text: 'A kihajtott papírcsík mögött üres a lemez helye. A két bemetszés és a kettős ceruzavonal megmaradt.' }));
archive.scenes[id('paper-fold')].rules.find(rule => rule.id === id('look:pencil'))!.messageVariants = witnessTaken.map(requires=>({ requires, text: 'A ceruzavonal mellett két üres bemetszés látszik. Innen csúsztattad ki a füstszínű lemezt; a félholdas vég már nem lóg a papír alól.' }));
archive.scenes[id('directory')].rules.find(rule => rule.id === id('look:margin'))!.messageVariants = witnessTaken.map(requires=>({ requires, text: 'Újra kihajtod a csíkot: „CÍMVÁLTÁS NEM SZEMÉLYVÁLTÁS”. Alatta: „A széket ne cseréljék ki.” A hátoldali bemetszések üresek; a lemezt már kivetted.' }));
archive.scenes[id('vestibule')].descriptionVariants = [{ requires: { flags: [id('records-open')] }, text: 'A lámpa a falitáblára és a beállított számlapra világít. Az irattári ajtó nyitva áll. Balra a körfolyosóra térhetsz vissza; az irattári ajtótól jobbra rácsos járda vezet a megfigyelőhídra. Alatta külön, JELFÜLKE feliratú lépcsőlejáró nyílik. A széken két egymásba csúszó horpadás.' }];
archive.scenes[id('vestibule')].rules.find(rule => rule.id === id('look:reader'))!.messageVariants = [{ requires: { flags: [id('records-open')] }, text: 'A három dob a beállított számokat mutatja. Alattuk továbbra is: „HELYI SZEMLE”. A kör, kettős vonal és háromszög változatlanul a keretbe van vésve. Az irattári ajtó zárja már elengedett.' }];
archive.scenes[id('vestibule')].rules.find(rule => rule.id === id('submit:reader'))!.messageVariants = [{ requires: { flags: [id('records-open')] }, text: 'A dobok ugyanabba az állásba kattanak vissza. Az irattári ajtó már nyitva áll; a kilincs lent marad.' }];

// The audible route is on the main path too: guessing the door code must not
// skip every answer. The optional reversible test establishes more, not a key.
const monitorText = 'A fal két nyitott lehallgatórácsából ugyanaz a rövid beszédszakasz ismétlődik: egy elharapott „még”, utána ugyanott megtörő lélegzet. A második rács egy ütemmel késik. A rácsokig végigkövethető kábel közös csomópontból ágazik; címkéi BELÜL 09 és FOLYOSÓ 90. A kábelrajz ezt a két kimenetet a körfolyosó visszhangágaihoz köti. Két helyi kimenet biztosan ugyanazt az ismételt szakaszt kapja. Két hallott hangból nem következik két beszélő; ettől még nem ismered minden ajtó hangforrását.';
const monitorQuiet = 'A MONITOR első csatlakozója nyitva van. A BELÜL 09 lehallgatórácsa néma, a FOLYOSÓ 90 rácsa tovább ismétli az elharapott „még” szót és ugyanazt a lélegzetakadást. A közös forrás kábele és a két külön kimeneti cím végigkövethető. Csak a két helyi lehallgatóágat vizsgáltad, nem az összes ajtó mögötti teret.';
const monitorMilestone = { id: id('shared-source-heard'), title: 'A levegő ugyanott fogyott el', text: 'Az irattár két lehallgatórácsából ugyanazt a félbemaradt szót hallottam. A lélegzet is pontosan ugyanott akadt meg, csak egy ütemmel később. Végigkövettem a kábeleket: ugyanabból a csomópontból ágaztak a két, külön címmel jelölt kimenethez. Legalább erről a két helyi visszhangágról tudtam már valamit. A hangok és a késések száma önmagában nem mondta meg, hányan beszélnek. A többi ajtó eredetét ezzel nem fejtettem meg.' };
const records = archive.scenes[id('record-room')], signals = archive.scenes[id('signal-room')];
const monitorVariants = [{ requires: { flags: [id('monitor-isolated')] }, text: monitorQuiet }];
records.environment!.push({ ...env('monitors', 'Két helyi lehallgatórács', monitorText), descriptionVariants: monitorVariants });
records.arrivalDiscoveries!.push(id('monitors'), id('accompanying-copy'));
records.description += ' ' + monitorText;
records.descriptionVariants = [{ requires: { flags: [id('monitor-isolated')] }, text: 'Az iratok a mennyezeti síneken lógnak; a munkalap a néma csengő mellett maradt. ' + monitorQuiet }];
records.rules.push(look('monitors', monitorText, { addFlags: [id('shared-source-heard')], milestone: monitorMilestone, messageVariants: monitorVariants }));
const enterRecords = archive.scenes[id('vestibule')].rules.find(rule => rule.id === id('move:records'))!;
enterRecords.message += ' ' + monitorText;
enterRecords.addFlags = [id('shared-source-heard'), id('copy-arrived')];
enterRecords.milestone = monitorMilestone;
enterRecords.messageVariants = [{ requires: { flags: [id('monitor-isolated')] }, text: 'Belépsz a függő iratok közé. ' + monitorQuiet }];
const monitorPanel = 'A MONITOR panel külön van a papírnyelv útvonal- és földelésváltójától. A közös forrás kábele BELÜL 09 és FOLYOSÓ 90 jelű hallgatóágra válik szét; a falrajz a körfolyosói visszhangágakhoz köti őket. Az első ág külön karja oldható. Nem a folyosó hangellátását zárod el: ezek helyi lehallgatócsatlakozók.';
signals.environment!.push({ ...env('monitor-switch', 'A MONITOR ág leválasztókarja', monitorPanel), descriptionVariants: [{ requires: { flags: [id('monitor-isolated')] }, text: monitorPanel + ' Az első csatlakozó most nyitott; a második folytonos maradt.' }] });
signals.arrivalDiscoveries!.push(id('monitor-switch'));
signals.description += ' A falon külön MONITOR panel: közös forrás, két címkézett hallgatóág és az első ág saját leválasztókarja.';
signals.rules.push(
  { id: id('use:monitor:isolate'), label: 'Működtetem', kind: 'use', interaction: { verb: 'use', target: target('monitor-switch') }, requires: { withoutFlags: [id('monitor-isolated')] }, addFlags: [id('monitor-isolated'), id('monitor-tested')], message: 'Kihúzod az első ág csatlakozóját. A BELÜL 09 helyi rácsa elnémul; a FOLYOSÓ 90 tovább mondja ugyanazt a fél szót, ugyanazzal az elakadó lélegzettel. A kábelük közös forrásra fut vissza. A második hallgatóág nem egy új beszélőtől kapott választ. Visszakapcsolhatod az elsőt; a papírnyelv váltói nem mozdultak.', milestone: { id: id('monitor-tested'), title: 'Az egyik elhallgatott', text: 'A külön MONITOR panelen leválasztottam az első helyi hallgatóágat. Az egyik rács elhallgatott, a másik tovább ismételte ugyanazt a beszédszakaszt. A kábel közös forrásra futott. Ezt a két hangot már nem számolhattam két külön beszélő bizonyítékának. Nem az összes folyosói ajtót némítottam el, és a forrás beszélőjét sem ismertem meg. De a sok hang nem követelt ugyanannyi embert.' } },
  { id: id('use:monitor:restore'), label: 'Működtetem', kind: 'use', interaction: { verb: 'use', target: target('monitor-switch') }, requires: { flags: [id('monitor-isolated')] }, removeFlags: [id('monitor-isolated')], message: 'Visszailleszted az első csatlakozót. Mindkét helyi hallgatórács szól, a második egy ütemmel később. A két régi útvonal- és földelésváltó a korábbi állásában maradt.' }
);
const copyBase = 'A beléptetőtől érkező másolósín végén külön KÍSÉRŐMÁSOLAT fekszik. A Másoló munkajelzése: „Jelenlegi továbbhaladás és régi hozzájárulás külön kezelve.” A RÉGI HOZZÁJÁRULÁS rovatot nem töltötte ki. A saját forrásfeljegyzés — ha van csatolva — külön kapocsba kerül; nem másolják át beleegyezésként. Ez a kiadott példány a munkalap rajzát nem helyettesíti.';
const copyReserved = copyBase + ' A másolósín a mostani kilépési lap megjegyzését is elhozta: „A KORÁBBI ÖNKÉNTESSÉGET NEM IGAZOLOM”. A Másoló ezt FENNTARTÁS CSATOLVA jelzéssel külön rovatba tette; nem töltötte ki helyette a régi hozzájárulást.';
const copyPlain = copyBase + ' A csatolt kilépési lap szerint most a továbbhaladást választottad. „JELENLEGI TOVÁBBHALADÁS” szerepel a másolaton, nem korábbi beleegyezés. Ugyanazokat az iratokat teszik hozzáférhetővé.';
const copyLegacy = copyBase + ' „MEGJEGYZÉS NINCS CSATOLVA” áll az érkező rovatban. Ebből nem következtetnek korábbi döntésedre; a bizonyítékokat így is megvizsgálhatod.';
const copyVariants = [
  { requires: { flags: ['awakening:departure-reserved'] }, text: copyReserved },
  { requires: { flags: ['awakening:departure-plain'] }, text: copyPlain },
];
records.environment!.push({ ...env('accompanying-copy', 'A Másoló kísérőmásolata', copyLegacy), descriptionVariants: copyVariants });
records.description += ' ' + copyBase;
for (const variant of records.descriptionVariants!) variant.text += ' ' + copyBase;
records.rules.push(look('accompanying-copy', copyLegacy, { addFlags: [id('copy-arrived')], messageVariants: copyVariants, milestone: { id: id('copy-kept-separate'), title: 'A rovat üres maradt', text: 'A beléptetőtől külön sín hozott lapot a Másoló kísérőmásolatához. A mostani továbbhaladás rovatát elválasztotta a régi hozzájárulásétól. Az utóbbit üresen hagyta. A hiányt nem töltötte ki azzal, hogy most elindultam. Egy helyi iraton már láttam ennek a megkülönböztetésnek a következményét, nem csak a saját feljegyzésemben.' } }));
signals.topics!.push({ id: id('tube-copy'), label: 'Miért külön másolod a megjegyzést?', target: id('tube'), requires: { flags: [id('copy-arrived')] } });
signals.rules.push({ id: id('talk:tube-copy'), label: 'Kérdezek', kind: 'talk', interaction: { verb: 'talk', target: target('tube'), topic: id('tube-copy') }, requires: { flags: [id('copy-arrived')] }, message: '„A sínről nem érkezett kilépési megjegyzés” – mondja a Másoló. „Azt írom rá, hogy nincs csatolva. Nem fogok aláírást kitalálni. Az iratokat ettől még kiadom.”', messageVariants: [
  { requires: { flags: ['awakening:departure-reserved'] }, text: '„Beért a sínen a lapod. A fenntartást külön másoltam” – mondja a Másoló. „Ha az üres régi rovatba tenném, én gyártanék beleegyezést. Nem vállalom. Azt a sort kapod vissza, amit most írtál; a régi iratokhoz nem nyúlok.”' },
  { requires: { flags: ['awakening:departure-plain'] }, text: '„A sínen a mostani továbbhaladásod érkezett meg” – mondja a Másoló. „Nem a korábbi bezárásod engedélye. Külön másoltam. Nem fogok régi aláírást csinálni belőle. Az iratokat ugyanúgy kiadom.”' },
] });
// Reading the old directory now also offers a physical cross-check, without
// changing its published historical milestone or claiming an identity.
const addressCrossCheck = ' A tábla alatti kábelcsatlakozón is BELÜL 09 és FOLYOSÓ 90 áll: ugyanazon helyi átjáró két oldala, nem két személy neve.';
archive.scenes[id('directory')].environment!.find(entity => entity.id === id('addresses'))!.description += addressCrossCheck;
archive.scenes[id('directory')].rules.find(rule => rule.id === id('look:addresses'))!.message += addressCrossCheck;
// Render the actual received annotation on return/reload as well, not only in
// an optional conversation. No new knowledge effects run during observation.
const recordSceneBase = 'Papírlapok lógnak a síneken, a régi átviteli munkalap a néma csengő mellett fekszik. ';
records.description = recordSceneBase + monitorText + ' ' + copyLegacy;
records.descriptionVariants = [false, true].flatMap(isolated => [
  ...copyVariants.map(variant => ({ requires: { flags: [...variant.requires.flags, ...(isolated ? [id('monitor-isolated')] : [])], withoutFlags: isolated ? [] : [id('monitor-isolated')] }, text: recordSceneBase + (isolated ? monitorQuiet : monitorText) + ' ' + variant.text })),
  { requires: { flags: isolated ? [id('monitor-isolated')] : [], withoutFlags: ['awakening:departure-reserved', 'awakening:departure-plain', ...(!isolated ? [id('monitor-isolated')] : [])] }, text: recordSceneBase + (isolated ? monitorQuiet : monitorText) + ' ' + copyLegacy },
]);
for (const variant of enterRecords.messageVariants!) variant.text += ' A beléptető másolósínje mellett a Másoló külön kísérőmásolata áll; a régi hozzájárulás rovatát üresen hagyta.';
enterRecords.message += ' A beléptető másolósínje mellett a Másoló külön kísérőmásolata áll; a régi hozzájárulás rovatát üresen hagyta.';
records.rules.find(rule => rule.id === id('look:accompanying-copy'))!.milestone!.text = 'Az irattárban megvizsgáltam a Másoló külön kísérőmásolatát. A jelenlegi továbbhaladás rovatát elválasztotta a régi hozzájárulásétól. Az utóbbit üresen hagyta. A hiányt nem töltötte ki a mostani mozgásommal vagy egy nem csatolt megjegyzés kitalálásával. Egy helyi iraton már láttam ennek a megkülönböztetésnek a következményét, nem csak a saját feljegyzésemben.';

// Observation and comparison are different events. An already isolated legacy
// branch cannot supply a memory of hearing both grilles together.
const quietMilestone = { id: id('isolated-source-seen'), title: 'A néma ág vezetéke', text: 'Az irattárban az egyik lehallgatórács néma volt. A másikból egy félbemaradt „még” és elakadó lélegzet ismétlődött. Végigkövettem a két címkézett kábelt a közös csomópontig. A BELÜL 09 csatlakozója nyitva állt, a FOLYOSÓ 90 ága folytonos maradt. A vezetékek közös forrásra futottak; két egyszerre szóló rács hangját ebből a megfigyelésből nem hasonlíthattam össze.' };
for (const [scene, rule] of [[records, records.rules.find(rule => rule.id === id('look:monitors'))!], [archive.scenes[id('vestibule')], enterRecords]] as const) {
  const isolatedRule: Rule = { ...rule, id: rule.id + ':isolated', requires: { ...rule.requires, flags: [...rule.requires?.flags ?? [], id('monitor-isolated')] }, addFlags: [id('isolated-source-seen'), ...(rule === enterRecords ? [id('copy-arrived')] : [])], milestone: quietMilestone };
  rule.requires = { ...rule.requires, withoutFlags: [...rule.requires?.withoutFlags ?? [], id('monitor-isolated')] };
  scene.rules.push(isolatedRule);
}
