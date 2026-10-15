import type { ArtSpot, Chapter, Requirement, Rule } from '../types.ts';

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
type Cell = { name: string; label: string; sketch: string; exit?: boolean; hidden?: boolean; actions?: ArtSpot['actions'] };
// Six separate, framed drawing regions leave enough room for touch targets.
// Hidden drawings are overlays, not part of the uninspected base illustration.
function drawing(caption: string, cells: Cell[]) {
  const lines = Array.from({ length: 25 }, (_, row) => row === 0 || row === 24 ? '+------------------------------------------------------------------------------+' : '|' + ' '.repeat(78) + '|');
  const write = (row: number, col: number, text: string) => { lines[row] = lines[row].slice(0, col) + text + lines[row].slice(col + text.length); };
  write(1, 3, caption);
  const artSpots: ArtSpot[] = cells.map((cell, index) => {
    const row = 3 + Math.floor(index / 2) * 7, col = 3 + (index % 2) * 39;
    const glyph = [cell.label, ...cell.sketch.split('\n')].join('\n');
    if (!cell.hidden) glyph.split('\n').forEach((line, offset) => write(row + offset, col, line));
    return { id: id(`spot:${cell.name}`), ...(cell.exit ? { exit: id(cell.name) } : { environment: id(cell.name) }), row, col, width: 35, height: 6,
      ...(cell.hidden ? { glyph } : {}), ...(cell.exit ? {} : { actions: cell.actions ?? ['look'] }) };
  });
  return { art: lines.join('\n'), artSpots };
}
const door = ' .--------.\n |        |\n |   []   |\n |________|';
const env = (name: string, label: string, description: string, requires?: Requirement) => ({ id: id(name), label, description, requires });
const exit = (name: string, label: string) => ({ id: id(name), label });
const selector = (name: string, value: string, message: string, addFlags: string[], removeFlags: string[]): Rule => ({
  id: id(`submit:${name}:${value}`), label: 'Átállítom', kind: 'submit',
  interaction: { verb: 'submit', target: target(name), input: value },
  requires: { discoveries: [id(name)] }, message, addFlags: addFlags.map(id), removeFlags: removeFlags.map(id),
});

export const archive: Chapter = {
  id: 'archive', title: 'II. A címek közötti csend',
  items: { 'archive:witness': 'Hasított tanúlemez' },
  itemDescriptions: { 'archive:witness': 'Keskeny, füstszínű lemez, egyik végén félhold alakú kivágással. A lyuksor nem betűket rajzol: három sűrű csoportot egyetlen magányos lyuk követ. A hátoldalán: „TANÚPÉLDÁNY / HELYBEN NEM OLVASHATÓ”. A széle sima, mintha sokáig hordták volna zsebben. Egyelőre csak a feliratát tudod elolvasni.' },
  itemArt: { 'archive:witness': ' .----------.\n | ::: :  ) |\n |__________|' },
  connections: [{
    from: 'threshold', exits: [exit('entry', 'A keskeny oldalsó átjáró')],
    artSpots: [{ id: id('spot:entry'), exit: id('entry'), row: 21, col: 29, width: 18, height: 3, glyph: '[ ARCHIVUM >> ]' }],
    rules: [{ ...move('entry', id('vestibule'), 'Az ablak melletti keskeny átjáró alacsony előcsarnokba vezet. Itt már nem hideg a levegő: papír és felhevült por szaga van.'),
      requires: { flags: ['awakening:chapter-closed'] },
      milestone: { id: id('arrival'), title: 'A papír szaga', text: 'Az üveg mögötti betűk mellett egy oldalsó átjárót találtam. Az előcsarnokban por melegedett egy lámpa alatt. Az archívum nem puszta felirat volt a folyosó ablakán: be lehetett lépni, meg lehetett érinteni a bútorait. A bejárat melletti széken két különböző mélységű horpadás maradt.' } },
      { ...move('entry', id('vestibule'), 'Az oldalsó átjáró olvasója egy jelen idejű kilépési bejegyzésre vár. A körfolyosó ablakának alján kopott sáv vezet a KILÉPÉSI SZEMLE mellékajtójához. Az ébresztőszoba nyitott ajtaját ez nem zárja vissza.', { withoutFlags: ['awakening:chapter-closed'] }), id: id('move:entry:awaiting-departure'), moveTo: undefined }],
  }],
  scenes: {
    'archive:vestibule': {
      title: '03 · Az iktató előcsarnoka', description: 'Alacsony lámpa világít a falitáblára és a lezárt irattári ajtó keskeny számlapjára. Balra nyitott híd, jobbra kábelcsatornával szegélyezett lejáró. Egy szék ülőlapján két egymásba csúszó horpadás látszik.',
      arrivalDiscoveries: [id('board'), id('reader'), id('chair')],
      environment: [env('board', 'Falitábla', 'A falitábla alatt hosszú, tiszta csík maradt a porban. Valaki nemrég kihúzott innen egy lapot.'), env('reader', 'Irattári számlap', 'Három üres számhely. A keretbe három jel van vésve: kör, kettős vonal, háromszög. A jelek balról jobbra követik egymást. A számlap alatt: „HELYI SZEMLE”.'), env('chair', 'Horpadásos szék', 'A széket a padlóhoz csavarozták. A széles horpadásban egy keskenyebb ülőhely nyoma fekszik, de a két benyomódás között nincs repedés. Az egyik első láb körül friss porgyűrű látszik; a többi láb mellett régi, sötét lerakódás.')],
      inputs: [{ id: id('reader'), label: 'Számlap', prompt: 'Három számhely', maxLength: 3, format: 'digits' }],
      exits: [exit('threshold', 'Vissza a körfolyosóra'), exit('bridge', 'A megfigyelőhídra'), exit('signals', 'Le a jelosztófülkébe'), exit('records', 'Az irattárba')],
      ...drawing('IKTATO / ALACSONY LAMPA', [
        { name: 'board', label: 'FALITABLA', sketch: '+----------------+\n| ====  ====     |\n| ____  ____     |\n+----------------+' },
        { name: 'reader', label: 'SZAMLAP', sketch: '  O    ||    /\\\n+----------------+\n| [ ]  [ ]  [ ]  |\n+----------------+' },
        { name: 'chair', label: 'SZEK', sketch: '  |      |\n  |______|\n /__{__}_/\n |      |' },
        { name: 'records', label: 'IRATTAR >>', sketch: door, exit: true },
        { name: 'threshold', label: '<< KORFOLYOSO', sketch: '<========', exit: true },
        { name: 'bridge', label: 'HID >>', sketch: '========>\n\nJELFULKE v', exit: true },
      ]),
      rules: [
        look('board', 'A táblán csúszó sín tartja a címjegyzéket. A fejléc alatti számsor nem dátum: két oszlop fut párhuzamosan, BELÜL és FOLYOSÓ felirattal.', { focusTo: id('directory') }),
        look('reader', 'A számlap üvege alatt három különálló dob vár. Kör, kettős vonal, háromszög: ugyanezek a jelek a híd felé futó kábelre is rá vannak festve. Az irattári ajtó felől gyenge papírzizegés hallatszik.'),
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
      ...drawing('FALITABLA / KOZELNEZET', [
        { name: 'addresses', label: 'BELUL       FOLYOSO', sketch: '07          70\n08          80\n09          90\n------------------' },
        { name: 'margin', label: 'BEHAJTOTT CSIK', sketch: ' .----------------.\n |______.          |\n        |__________|' },
      ]),
      rules: [look('addresses', 'A 09 és a 90 ugyanazon a soron áll: BELÜL 09 — FOLYOSÓ 90. A fejléc kettős címzésnek nevezi. Nem két szobát találtál, hanem ugyanannak az átjárónak két helyi címét. A tábláról nem derül ki, miért fordítják meg a számokat.', { notes: ['A helyi címjegyzék egy sorban párosítja a belső 09-et és a folyosói 90-et; az eltérő számozás célját nem magyarázza.'], milestone: { id: id('addresses-read'), title: 'Ugyanannak az ajtónak két címe', text: 'A falitáblán egymás mellé került a két szám, amely az ajtómon zavart: belül 09, a folyosón 90. A többi átjárónál is két külön cím szerepelt. Legalább ezt nem az emlékezetem tévesztette össze. Aki a táblát készítette, szándékosan tartotta fenn mindkettőt. Az okát nem írta oda.' } }),
        look('margin', 'Kihajtod a vékony csíkot. „CÍMVÁLTÁS NEM SZEMÉLYVÁLTÁS” – áll rajta. Alatta ceruzával: „A széket ne cseréljék ki.” A papír hátulján egy sötét réteg válik el a rostoktól.', { focusTo: id('paper-fold') })],
    },
    'archive:paper-fold': {
      detailOf: id('directory'), title: 'A falitábla · a papírcsík hátoldala', description: 'A kihajtott csík mögött vékony füstszínű lemez lapul. A ceruzavonal a papíron két alkalommal futott végig: az egyik húzás sokkal halványabb.',
      arrivalDiscoveries: [id('pencil')],
      environment: [env('pencil', 'Kettős ceruzavonal', 'A sötét vonal a szék szót húzza alá. A halványabb ugyanott kezdődik, de a végén eltéved: egy apró, üres négyszöget rajzol a margóra. A papíron nincs név vagy aláírás.'), env('loose-witness', 'Füstszínű lemez', 'A papír mögé csúsztatott lemeznek félholdas a vége. A lyukak körül finom, fehér perem látszik. A hátoldal apró felirata tanúpéldánynak nevezi.', { withoutItems: [id('witness')] })],
      ...drawing('PAPIRCSIK / HATOLDAL', [
        { name: 'pencil', label: 'CERUZAVONAL', sketch: ' SZEK\n ======== ... []\n ----------------' },
        { name: 'loose-witness', label: 'VEKONY LEMEZ', sketch: ' .----------.\n | ::: :  ) |\n |__________|', hidden: true, actions: ['look', 'take'] },
      ]),
      rules: [look('pencil', 'A ceruzavonal mellett ragasztó helyett két kis bemetszés fogott közre egy lapos lemezt. A félholdas vég kilóg a papír alól.', { discover: [id('loose-witness')] }),
        { id: id('take:witness'), label: 'Felveszem', kind: 'take', interaction: { verb: 'take', target: target('loose-witness') }, requires: { discoveries: [id('loose-witness')], withoutItems: [id('witness')] }, addItems: [id('witness')], message: 'A lemez könnyedén kicsúszik a bemetszésekből. A hátoldalán tisztán kivehető: „TANÚPÉLDÁNY / HELYBEN NEM OLVASHATÓ”. A papír visszahajlik az üres helyére.', notes: ['Hasított tanúlemezt találtam a címjegyzék mögött. Felirata szerint helyben nem olvasható.'] }],
    },
    'archive:bridge-room': {
      title: '04 · A megfigyelőhíd', description: 'Rácspadló feszül az üvegfal mentén. Lent betűk úsznak egymáson keresztül. Három kis műszer egyenletesen világít; a korlát végén üvegbúra alatt papírnyelv remeg.',
      arrivalDiscoveries: [id('gauges'), id('glass'), id('tongue')],
      environment: [env('gauges', 'Három szemlejelző', 'A három jelző külön kábelből kap fényt. A foglalatokra kört, kettős vonalat és háromszöget festettek; a számaik nem változnak a betűk mozgásával.'), env('glass', 'Betűk az üveg alatt', 'A mélységet nem lehet felmérni. Egy N betű végigcsúszik az üvegen, a lába mögött árnyék helyett egy kisebb n marad. Amikor rátartod a kezedet, mindkettő eltávolodik, de nem ugyanabba az irányba.'), env('tongue', 'Papírnyelv az üvegbúrában', 'A papírnyelv két rézérintkező között leng. A búrán: „OLVASÁS / KÜLSŐ HÍDÁG”. Alatta két lámpa: útvonal és földelés. A gépezet nem a rácspadlót mozgatja, hanem valamit a papír körül.')],
      exits: [exit('bridge-return', 'Vissza az iktatóhoz')],
      ...drawing('MEGFIGYELOHID / RACSPADLO', [
        { name: 'gauges', label: 'SZEMLEJELZOK', sketch: ' [O]   [||]  [/\\]\n [ ]   [  ]  [  ]\n  |      |     |' },
        { name: 'glass', label: 'UVEG / MELYSEG', sketch: '+------------------+\n| N     .      n   |\n|   .     A     .  |\n+------------------+' },
        { name: 'tongue', label: 'UVEGBURA', sketch: '  .--------.\n /   |~     \\\n | o |   o  |\n +----------+' },
        { name: 'bridge-return', label: '<< IKTATO', sketch: '<===|==|==|===', exit: true },
      ]),
      rules: [look('gauges', 'A kör foglalatában 4 áll, a kettős vonalnál 2, a háromszögnél 7. Mindhárom számot a burkolat alá karcolták; a fény csak megvilágítja őket. A közös kábel visszafut az iktató számlapjához.', { notes: ['A híd szemlejelzőin: kör — 4; kettős vonal — 2; háromszög — 7.'] }),
        look('tongue', 'A papírnyelv össze-vissza rebben, a rézérintkezők között nem ér át semmi. Az útvonal- és földelésjelző közül legalább az egyik sötét.', { requires: { discoveries: [id('tongue')], withoutFlags: [id('route-bridge')] } }),
        { ...look('tongue', 'Az útvonallámpa világít, de a papír körül apró szikrák ugranak a belső érintkezőre. A földelésjelző sötét.', { requires: { discoveries: [id('tongue')], flags: [id('route-bridge')], withoutFlags: [id('ground-outer')] } }), id: id('look:tongue:ungrounded') },
        { ...look('tongue', 'Mindkét lámpa felgyullad. A papírnyelv kisimul a búrában: „ÁTVÉTEL MEGTAGADVA / TANÚ HIÁNYZIK”. A sor alá egy második, keskenyebb sor nyomódik, de a tinta felét visszaszívja a papír. Csak ennyi marad: „…nem ugyanaz kérte.” A lemezolvasó helye üres: a búra mellett lezárt kábelcsonk lóg.', { requires: { discoveries: [id('tongue')], flags: [id('route-bridge'), id('ground-outer')] }, notes: ['A híd olvashatóvá vált jelzése átvételi megtagadásról és hiányzó tanúról szól. Egy hiányos második sor: „…nem ugyanaz kérte.”'], milestone: { id: id('signal-read'), title: 'A tinta visszahúzódott', text: 'A jelosztó útvonalai végül csendes fényt adtak az üvegbúrában. A papíron átvételi megtagadás állt, egy hiányzó tanú miatt. Nem szerepelt rajta, ki adott volna át mit. Aztán megjelent egy második sor, és majdnem azonnal eltűnt. A maradék szavakat magammal vittem: „nem ugyanaz kérte”. Nem tudtam, minek a kérelméről beszél a papír. A tinta úgy húzódott vissza, mintha ő is meggondolta volna magát.' } }), id: id('look:tongue:readable') },
        move('bridge-return', id('vestibule'), 'A rácspadló zengése az előcsarnok küszöbén elhal.')],
    },
    'archive:signal-room': {
      title: '05 · A jelosztófülke', description: 'A fülkében vastag kábelek fordulnak a mennyezet felé. Két külön selector ül a porcelánlapon: az egyik a jel útját váltja, a másik a földelést. A sarokban beszédcső sárgaréz szája sötétlik.',
      arrivalDiscoveries: [id('route'), id('ground'), id('tube')],
      environment: [env('route', 'Útvonalváltó', 'A porcelánkapcsoló két állásának felirata HID és TAR. Az első kábel a rácspadló alá fut, a második a mennyezetben tűnik el. A feliratokat valaki utánavéste, mert az eredeti festék lekopott.'), env('ground', 'Földelésváltó', 'A második kapcsoló jelölése KULSO és BELSO. A külső kábel az üvegfal pereméhez vezet. A belső sötétebb, szövettel burkolt; apró rezgéseket ad át a porcelánnak.'), env('tube', 'Sárgaréz beszédcső', 'A cső belsején páracseppek ülnek, bár a fülke száraz. A perem nem hangszórórács: nyitott cső fordul bele a falba. A saját lélegzeted csak későn ér vissza.')],
      inputs: [{ id: id('route'), label: 'Útvonal', prompt: 'A kapcsoló felirata', maxLength: 3, format: 'text' }, { id: id('ground'), label: 'Földelés', prompt: 'A kapcsoló felirata', maxLength: 5, format: 'text' }],
      topics: [{ id: id('tube-place'), label: 'Ki van a cső végén?', target: id('tube') }, { id: id('tube-name'), label: 'A nevedről kérdezem', target: id('tube') }, { id: id('tube-paper'), label: 'A papírról kérdezem', target: id('tube'), requires: { flags: [id('signal-read-heard')] } }],
      exits: [exit('signals-return', 'Fel az iktatóhoz')],
      ...drawing('JELOSZTO / PORCELAN ES REZ', [
        { name: 'route', label: 'UTVONAL', sketch: ' HID     TAR\n  o---/---o\n   |     |\n   |     |' },
        { name: 'ground', label: 'FOLDELES', sketch: ' KULSO   BELSO\n  o---/---o\n  ===    ===\n   =      =' },
        { name: 'tube', label: 'BESZEDCSO', sketch: '   .----.\n ==(    )\n   `----\'', actions: ['look', 'talk', 'attack'] },
        { name: 'signals-return', label: 'LEPCSO ^ IKTATO', sketch: '       ___\n    __|\n __|', exit: true },
      ]),
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
      ...drawing('FUGGO IRATTAR / MENNYEZETI SINEK', [
        { name: 'work-sheet', label: 'MUNKALAP', sketch: ' .----------------.\n | --+-- / --+--  |\n |   |  /    |    |\n |________________|' },
        { name: 'hanging', label: 'SINEK / IRATOK', sketch: '==================\n | |      | | |\n[_][_]   [_][_][_]\n | |      | | |' },
        { name: 'bell', label: 'CSENGO', sketch: '   .--.\n  /    \\\n /______\\\n    |----' },
        { name: 'records-return', label: '<< IKTATO', sketch: door, exit: true },
      ]),
      rules: [look('work-sheet', 'Az átviteli rajzon a HID ág a papírnyelvhez fut, a TAR ág egy sötét téglalapba. A papírnyelv körül csak a KULSO érintkező van tisztára rajzolva; a BELSO mellett fekete pontsor áll. Az alsó megjegyzés: „BELSŐ TERHELÉS MELLETT A SOR VISSZAHÚZÓDIK.” Nincs rajta személynév.', { notes: ['A munkalap a hídág papírnyelvét és a külső érintkezőt rajzolja tisztán. Belső terhelésnél a sor visszahúzódik.'], addFlags: [id('signal-read-heard')] }),
        move('records-return', id('vestibule'), 'A függő lapok még ringanak egy kicsit, amikor kilépsz.')],
    },
  },
};

// The signal stair occupies a separate lower-right drawing region.
const witnessTaken = { items: [id('witness')] };
for (const [name, flag, off, on] of [
  ['route', 'route-bridge', 'UTVONAL\n HID     TAR\n          ^', 'UTVONAL\n HID     TAR\n  ^'],
  ['ground', 'ground-outer', 'FOLDELES\n KULSO   BELSO\n           ^', 'FOLDELES\n KULSO   BELSO\n   ^'],
] as const) {
  const spot = archive.scenes[id('signal-room')].artSpots!.find(spot => spot.environment === id(name))!;
  spot.glyph = off;
  spot.glyphVariants = [{ requires: { flags: [id(flag)] }, text: on }];
}
archive.scenes[id('vestibule')].artSpots!.find(spot => spot.exit === id('records'))!.glyphVariants = [{ requires: { flags: [id('records-open')] }, text: 'IRATTAR >>\n .------------.\n | NYITVA     |\n | /          |\n |/           |\n +------------+' }];
archive.scenes[id('paper-fold')].descriptionVariants = [{ requires: witnessTaken, text: 'A kihajtott papírcsík mögött üres a lemez helye. A két bemetszés és a kettős ceruzavonal megmaradt.' }];
archive.scenes[id('paper-fold')].rules.find(rule => rule.id === id('look:pencil'))!.messageVariants = [{ requires: witnessTaken, text: 'A ceruzavonal mellett két üres bemetszés látszik. Innen csúsztattad ki a tanúlemezt; a félholdas vég már nem lóg a papír alól.' }];
archive.scenes[id('directory')].rules.find(rule => rule.id === id('look:margin'))!.messageVariants = [{ requires: witnessTaken, text: 'Újra kihajtod a csíkot: „CÍMVÁLTÁS NEM SZEMÉLYVÁLTÁS”. Alatta: „A széket ne cseréljék ki.” A hátoldali bemetszések üresek; a lemezt már kivetted.' }];
archive.scenes[id('vestibule')].descriptionVariants = [{ requires: { flags: [id('records-open')] }, text: 'A lámpa a falitáblára és a beállított számlapra világít. Az irattári ajtó nyitva áll. Balra híd, jobbra kábelcsatornás lejáró; a széken két egymásba csúszó horpadás.' }];
archive.scenes[id('vestibule')].rules.find(rule => rule.id === id('look:reader'))!.messageVariants = [{ requires: { flags: [id('records-open')] }, text: 'A három dob a beállított számokat mutatja. A kör, kettős vonal és háromszög változatlanul a keretbe van vésve. Az irattári ajtó zárja már elengedett.' }];
archive.scenes[id('vestibule')].rules.find(rule => rule.id === id('submit:reader'))!.messageVariants = [{ requires: { flags: [id('records-open')] }, text: 'A dobok ugyanabba az állásba kattanak vissza. Az irattári ajtó már nyitva áll; a kilincs lent marad.' }];
archive.scenes['archive:vestibule'].artSpots!.push({ id: id('spot:signals'), exit: id('signals'), row: 22, col: 42, width: 35, height: 1, glyph: '[ JELFULKE v ]' });
archive.scenes[id('vestibule')].artSpots!.find(spot => spot.environment === id('reader'))!.glyphVariants = [{ requires: { flags: [id('records-open')] }, text: 'SZAMLAP\n  O    ||    /\\\n+----------------+\n| [4]  [2]  [7]  |\n+----------------+' }];
archive.scenes[id('bridge-room')].artSpots!.find(spot => spot.environment === id('tongue'))!.glyphVariants = [
  { requires: { flags: [id('route-bridge'), id('ground-outer')] }, text: 'UVEGBURA\n  .--------.\n /   |      \\\n | * |   *  |\n +----------+' },
  { requires: { flags: [id('route-bridge')] }, text: 'UVEGBURA\n  .--------.\n /   |~     \\\n | * |   o  |\n +----------+' },
  { requires: { flags: [id('ground-outer')] }, text: 'UVEGBURA\n  .--------.\n /   |~     \\\n | o |   *  |\n +----------+' },
];
