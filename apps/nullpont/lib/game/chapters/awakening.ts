import type { Chapter, Requirement, Rule } from '../types.ts';
import { bindScene, itemArts } from '../presentation/index.ts';

export const INTRO = 'Hideg padlón ébredsz. A szoba üresnek tűnik: egy fekvőlap, egy ajtó és egy néma falpanel. Nincs ablak. Nincs emlék. A falon halvány felirat: ÉV 7314 / ÉBRESZTÉS 09. A csuklódon kilenc apró heg. Valahonnan a saját hangodat hallod: „Ha újra felébredsz, ne mondd meg nekik a neved.”';
export const OPENING_ENTRY = { id: 'awakening:wake', chapter: 'I. Az ébredés', title: 'A kilencedik ébredés', text: 'A hideg volt az első emlékem. Nem egy arc, nem egy név: a padló hidege az arcom alatt. Amikor kinyitottam a szememet, az üres szoba falán a 7314-es évszám derengett. A csuklómon kilenc heg sorakozott. Aztán meghallottam a saját hangomat, bár a szám nem mozdult. Arra kért, ne mondjam meg nekik a nevemet. Egyelőre nem is tudtam volna.', turn: 0 };
const description = 'A hideg fényben egy fekvőlap, egy zárt ajtó és egy falpanel rajzolódik ki. A mennyezeten egy apró hangszóró figyel. A falon: ÉBRESZTÉS 09 / ÉV 7314.';
export const awakening: Chapter = {
  id: 'awakening', title: 'I. Az ébredés',
  items: { foil: 'Vezető fólia', wire: 'Szigetelt huzal', bridge: 'Áthidaló hurok' },
  itemDescriptions: { foil: 'A fólia vékony és puha. Apró, szabályos bemélyedések futnak a felületén, mint egy hang hullámai.', wire: 'Rövid, hajlítható huzal. A szigetelés ép, csak a két végén látszik csupasz fém.', bridge: 'A kész hurok könnyedén elfér a tenyeredben. A fólián lévő mintázat most szabályos körbe zárul.' },
  itemArt: itemArts(['foil', 'wire', 'bridge']),
  scenes: {
    chamber: { title: '01 · Az üres szoba', description,
      arrivalDiscoveries: ['bed', 'panel', 'door', 'speaker'],
      environment: [{ id: 'bed', label: 'Fekvőlap' }, { id: 'panel', label: 'Falpanel' }, { id: 'door', label: 'Ajtó' }, { id: 'speaker', label: 'Hangszóró', description: 'A mennyezeti rács mögött egyetlen membrán ül. A peremére apró betűkkel ezt vésték: ŐR–0. A beszéd előtt halk kattanás hallatszik belőle.' }],
      exits: [{ id: 'door', label: 'Az ajtó felé', requires: { discoveries: ['door'] } }],
      topics: [{ id: 'identity', label: 'Ki vagyok?', target: 'speaker', requires: { flags: ['voice-heard'] } }, { id: 'help', label: 'A kijutásról', target: 'speaker', requires: { flags: ['voice-heard'] } }],
      ...bindScene('chamber'), rules: [
      { id: 'look:room', label: 'Körülnézek', kind: 'look', discover: ['bed', 'panel', 'door', 'speaker'], message: description + ' A fekvőlap pereme felpúposodott. A panel felől gyenge zúgás hallatszik.' },
      { id: 'look:bed', label: 'Megvizsgálom a fekvőlapot', kind: 'look', addFlags: ['bed-seen'], focusTo: 'awakening:bed-detail', message: 'Közel hajolsz a hideg vizsgálóasztalhoz. A felszíne sima, de a felpúposodott perem árnyékában egy keskeny rés fut.' },
      { id: 'look:panel', label: 'Megvizsgálom a falpanelt', kind: 'look', addFlags: ['panel-seen'], focusTo: 'awakening:panel-detail', message: 'Közelről hajszálrepedések látszanak a matt burkolaton. Két különböző szélességű fémfelületet és egy nyitott vájatot veszel észre.' },
      { id: 'look:door', label: 'Megvizsgálom az ajtót', kind: 'look', message: 'Az ajtón nincs kilincs. A paneltől egy kábel vezet a zárhoz. A 09-es szám alatt pici betűk: „BELSŐ KARANTÉN / ÖNKÉNTES”. Önkéntes?', notes: ['A szoba ajtaján: „Belső karantén / önkéntes”.'] },
      { id: 'talk:voice', label: 'Megszólítom a hangot', kind: 'talk', addFlags: ['voice-heard'], message: '„Ébren vagy” – mondja a hang. „Én ŐR–0 vagyok. Nem emlékezhetek rád. Ezt te kérted.” Rövid csend. „A kilencedik alkalommal már nem mondhatom, hogy örülök.”', notes: ['ŐR–0 szerint én kértem, hogy ne emlékezzen rám. Ez a kilencedik alkalom.'], milestone: { id: 'awakening:guardian', title: 'A felejtés őre', text: 'A mennyezet hangszórója ŐR–0 néven mutatkozott be. Azt állította, hogy én kértem tőle a felejtést. Nem csak én veszítettem el az emlékeimet: valaki gondosan eltüntette a nyomomat a saját őröm fejéből is. És ez a valaki talán én voltam.' } },
      { id: 'talk:identity', label: 'Megkérdezem, ki vagyok', kind: 'talk', requires: { flags: ['voice-heard'] }, addFlags: ['identity-heard'], message: '„A nyilvántartás szerint te vagy az archivista. A nyilvántartást szerinted meghamisították.” A hang suttogásra vált. „A nevedet nem őrzöm. De a törlési kérelmeden a holnapi dátum szerepel.”', notes: ['ŐR–0 archivistának nevezett. Szerinte a törlési kérelmen holnapi dátum szerepel; nem tudom, mi magyarázza ezt.'], milestone: { id: 'awakening:identity', title: 'A holnapi kérelem', text: 'Archivista. Ez volt az első szó, amellyel magamat azonosíthattam, és azonnal kétségbe is kellett vonnom. ŐR–0 szerint a nyilvántartás hamis lehetett. Azt is állította, hogy a törlési kérelmen holnapi dátum szerepel. Nem tudtam, mit jelent: nem láttam a kérelmet, és a hiányzó emlékeim sem bizonyították, mi történt.' } },
      { id: 'talk:help', label: 'Az ajtóról kérdezem', kind: 'talk', requires: { flags: ['voice-heard'] }, message: '„Az ajtó nem az én parancsomra nyílik.” A hang elhallgat. „A zár állapotát látom. A döntésedet nem.”' },
      { id: 'attack:voice', label: 'Megütöm a hangszóró burkolatát', kind: 'attack', message: 'A burkolat tompán kong. A kezedet puha erőtér fogja meg. „Az indulatot feljegyeztem” – mondja ŐR–0. „Ezt a szabályt is te írtad.”', notes: ['Puha erőtér fogta meg a kezem. ŐR–0 szerint én írtam ennek a szabályát.'] },
      { id: 'combine:foil:wire', label: 'Fólia + huzal → áthidaló hurok', kind: 'combine', requires: { items: ['foil', 'wire'] }, removeItems: ['foil', 'wire'], addItems: ['bridge'], message: 'A fóliát a huzal két végére hajtod. Rugalmas, bevont áthidaló hurok lesz belőle. A mozdulat túlságosan ismerős. Valaha már csináltad ezt.', milestone: { id: 'awakening:craft', title: 'A kezem emlékezett', text: 'Fóliát hajtottam a huzal két végére, majd hurokká görbítettem. Az ujjaim tudták, mit kell tenniük, mielőtt végiggondolhattam volna. Nem tért vissza egyetlen emlékkép sem, mégis bizonyos voltam benne: a testem már ismerte ezt a feladatot.' } },
      ...['foil', 'wire', 'bridge'].flatMap(item => [
        { id: `use:${item}:door`, label: `${{ foil: 'Vezető fólia', wire: 'Szigetelt huzal', bridge: 'Áthidaló hurok' }[item]} → ajtó`, kind: 'use' as const, requires: { items: [item] }, message: 'A sima ajtólap nem reagál az érintésre.' },
        ...(item === 'bridge' ? [] : [{ id: `use:${item}:panel`, label: `${item === 'foil' ? 'Vezető fólia' : 'Szigetelt huzal'} → falpanel`, kind: 'use' as const, requires: { items: [item] }, message: item === 'foil' ? 'A vékony lap lecsúszik az érintkezőkről. A panel sötét marad.' : 'A huzal vége alig ér a szélesebb fémfelülethez. Halk kattanás hallatszik, aztán csend.' }]),
      ]),
      { id: 'use:bridge:panel', label: 'Áthidaló hurok → falpanel', kind: 'use', requires: { items: ['bridge'] }, addFlags: ['door-open'], message: 'A hurkot az érintkezőkhöz illeszted. A panel felvillan: „HANGMINTA ELFOGADVA”. Pedig nem szóltál. Az ajtó kinyílik. ŐR–0: „Nyolcszor belülről zártad be. Ez az első, hogy kifelé indulsz.” A hurkot visszateszed a zsebedbe.', notes: ['A hurok a hangmintámat hordozta. Az ajtót korábban nyolcszor én zártam be.'], milestone: { id: 'awakening:door', title: 'A zár visszhangja', text: 'A panel elfogadta a hangmintámat, pedig nem beszéltem. A hurok hordozott valamit belőlem, amit én nem ismertem fel. Amikor az ajtó elmozdult, ŐR–0 azt mondta: nyolcszor én zártam be, belülről. A kilencedik ébredéskor először próbáltam kifelé indulni. Nem tudtam, mitől védett eddig ez a szoba.' } },
      { id: 'move:blocked', label: 'Megpróbálok kimenni', kind: 'move', requires: { withoutFlags: ['door-open'] }, message: 'Az ajtó meg sem rezdül.' },
      { id: 'move:threshold', label: 'Kilépek a folyosóra', kind: 'move', requires: { flags: ['door-open'] }, moveTo: 'threshold', message: 'Kilépsz. A sajátoddal együtt tizenkét ajtó sorakozik a körfolyosón. Mindegyik felől a te hangod hallatszik, egy másodperc eltéréssel. A többi ajtó zárva van; nem látsz a túloldalukra. A kijelzőn: „EGYETLEN SZEMÉLYZETI TAG AKTÍV.”', notes: ['Tizenkét ajtó felől a saját hangom hallatszik. A kijelző mégis egyetlen aktív személyt jelez.'], milestone: { id: 'awakening:threshold', title: 'Tizenkét hang, egyetlen ember', text: 'Kiléptem a körfolyosóra. Tizenkét ajtó felől hallottam a saját hangomat, mindegyikből egy másodperc késéssel. Nem láttam, mi van a zárt ajtók mögött. A kijelző egyetlen aktív személyzeti tagot jelzett. Visszanéztem az ajtómra: kívülről 90-es számot viselt, nem 09-est. A folyosó végén valami lassan mozdult az üveg mögött.' } },
    ] },
    threshold: { title: '02 · A küszöb', description: 'A körfolyosó falán számozott ajtók sorakoznak. Az üveg mögött lassan elmozdulnak a fényes jelek; rajta ARCHÍVUM felirat. Az ablak alatti sávon: „NEM VAGY EGYEDÜL”. A kijelző továbbra is egyetlen aktív személyzeti tagot jelez.', arrivalDiscoveries: ['hall-window'], requires: { flags: ['door-open'] },
      environment: [{ id: 'hall-window', label: 'Folyosó ablaka' }], exits: [{ id: 'chamber', label: 'Vissza a szobába' }],
      ...bindScene('threshold'), rules: [
      { id: 'look:hall', label: 'Megnézem a folyosót', kind: 'look', message: 'Az üvegen az ARCHÍVUM név, az ablak alatti sávon: „NEM VAGY EGYEDÜL”. Ez egy felirat, nem bizonyíték arra, ki lehet még itt; a kijelző egyetlen aktív személyzeti tagot jelez. Az üvegen túl nem csillagok látszanak, hanem lassan mozgó betűk. Egy mondat újra és újra összeáll: „AZ ARCHÍVUM NEM A MÚLTAT ŐRZI.”', notes: ['Az archívum nem a múltat őrzi.', 'A folyosó felirata: „NEM VAGY EGYEDÜL”; a kijelző mégis egyetlen aktív személyzeti tagot jelez.'] },
      { id: 'move:chamber', label: 'Visszamegyek a szobába', kind: 'move', moveTo: 'chamber', message: 'Visszatérsz a szobába. Az ajtó nyitva marad, ŐR–0 vár.' },
    ] },
    'awakening:bed-detail': {
      detailOf: 'chamber', title: 'Fekvőlap', description: 'Közel hajolsz a hideg fekvőlaphoz. A pereménél sötét rés húzódik, az egyik sarokban süllyesztett rögzítő látszik.',
      arrivalDiscoveries: ['awakening:bed-rim-edge', 'awakening:bed-fastener'],
      environment: [
        { id: 'awakening:bed-rim-edge', label: 'Fekvőlap pereme' },
        { id: 'awakening:bed-fastener', label: 'Süllyesztett rögzítő', description: 'A csavar fejének mélyedése nem szabályos. Ugyanaz a rövid vonás kilencszer ismétlődik körülötte. A csavar maga nem mozog; a jelölések a fémet ért régebbi karcok.' },
      ],
      ...bindScene('awakening:bed-detail'),
      rules: [{ id: 'look:rim', label: 'Megnézem a perem alját', kind: 'look', focusTo: 'awakening:bed-rim', message: 'A résbe nézel. A fém alsó oldalán karcolás fut: „A zár nem kulcsot kér. Visszhangot.”', notes: ['A fekvőlapba karcolva: „A zár nem kulcsot kér. Visszhangot.”'], interaction: { verb: 'look', target: { kind: 'environment', id: 'awakening:bed-rim-edge' } } }],
    },
    'awakening:bed-rim': {
      detailOf: 'awakening:bed-detail', title: 'Perem alatti mélyedés', description: 'A fekvőlap pereme alatti keskeny mélyedés. A fém felszínén egy karcolás fut.',
      arrivalDiscoveries: ['loose-foil', 'awakening:bed-rim-mark'],
      environment: [
        { id: 'loose-foil', label: 'Fóliadarab', description: 'A perem alá szorult ezüstös lap széle felpöndörödött. A felületén finom, szabályos barázdák futnak; amikor megérinted, megőrzi az ujjad melegét.', requires: { withoutItems: ['foil', 'bridge'] } },
        { id: 'awakening:bed-rim-mark', label: 'Karcolás a perem alatt', description: '„A zár nem kulcsot kér. Visszhangot.” A betűket nem egy szerszám szabályos hegye vágta: egyes vonások mélyek, mások szinte eltűnnek. Az utolsó pont külön kis horpadás.' },
      ],
      ...bindScene('awakening:bed-rim'),
      rules: [{ id: 'take:foil', label: 'Felveszem a fóliát', kind: 'take', requires: { flags: ['bed-seen'], withoutItems: ['foil', 'bridge'] }, addItems: ['foil'], message: 'A fekvőlap pereme alól kihúzod a vezető fóliát. A tenyeredben melegszik, mintha felismerne.' }],
    },
    'awakening:panel-detail': {
      detailOf: 'chamber', title: 'Falpanel belseje', description: 'A nyitott burkolatban két érintkezőt és egy vájatot látsz. Az érintkezők között futó vonal megszakad.',
      arrivalDiscoveries: ['loose-wire', 'awakening:panel-contacts'],
      environment: [
        { id: 'loose-wire', label: 'Huzaldarab', description: 'Rövid, sötét szigetelésű huzal fekszik a burkolat résében. A végein csupasz fém csillan, a közepe enyhe ívben meghajlott.', requires: { withoutItems: ['wire', 'bridge'] } },
        { id: 'awakening:panel-contacts', label: 'Érintkezők', description: 'VISSZA és HANG. A kopott feliratok alatt a fémfelületek különböző szélességűek. Egy halvány vonal körbefut közöttük, aztán megszakad. A keskenyebb érintkező szélén megolvadt fémpötty csillan.' },
      ],
      ...bindScene('awakening:panel-detail'),
      rules: [{ id: 'take:wire', label: 'Felveszem a huzalt', kind: 'take', requires: { flags: ['panel-seen'], withoutItems: ['wire', 'bridge'] }, addItems: ['wire'], message: 'A falpanel nyitott vájatából kiemelsz egy rövid huzalt. A szigetelése ép, de a végein nincs érintkezőfelület.' }],
    },
  },
};

const opened = { flags: ['door-open'] };
awakening.scenes.chamber.descriptionVariants = [{ requires: opened, text: 'A fekvőlap és a hangszóró változatlanul áll a hideg fényben. A falpanel világít, a 09-es ajtó nyitva: mögötte a körfolyosó. A falon: ÉBRESZTÉS 09 / ÉV 7314.' }];
for (const rule of awakening.scenes.chamber.rules) {
  const text = ({
    'look:room': awakening.scenes.chamber.descriptionVariants[0].text,
    'look:door': 'A 09-es ajtó nyitva áll. A kábel végén a zár nyelve visszahúzódott. A felirat továbbra is: „BELSŐ KARANTÉN / ÖNKÉNTES”.',
    'look:panel': 'A falpanel világít. A két érintkező között már nem szakad meg a fény: a kijelzőn „HANGMINTA ELFOGADVA”. Közel hajolsz a nyitott vájathoz.',
    'use:bridge:panel': 'A panel ismét felismeri a hurkot. „HANGMINTA ELFOGADVA.” Az ajtó már nyitva áll; a hurkot visszateszed a zsebedbe.',
    'talk:help': '„A zár nyitva van” – mondja ŐR–0. „A folyosóra vezető utat innen látom.”',
    'use:foil:panel': 'A fólia hozzáér a burkolathoz. A panel tovább világít; az ajtó nyitva marad.',
    'use:wire:panel': 'A huzal hozzáér a burkolathoz. A panel tovább világít; az ajtó nyitva marad.',
  } as Record<string, string>)[rule.id];
  if (text) rule.messageVariants = [{ requires: opened, text }];
}
awakening.scenes['awakening:bed-rim'].descriptionVariants = ['foil', 'bridge'].map(item => ({ requires: { items: [item] }, text: 'A perem alatti mélyedés üres; a kivett fólia helyén tisztább folt maradt. Mellette továbbra is olvasható a karcolás: „A zár nem kulcsot kér. Visszhangot.”' }));
awakening.scenes['awakening:panel-detail'].descriptionVariants = [
  { requires: opened, text: 'A falpanel érintkezői világítanak. VISSZA és HANG: a feliratok között fény fut végig, a kijelzőn „HANGMINTA ELFOGADVA”. A huzal egykori vájata üres.' },
  ...['wire', 'bridge'].map(item => ({ requires: { items: [item] }, text: 'VISSZA és HANG: két különböző szélességű érintkező, közöttük megszakadó vonal. A burkolat vájata üres: a huzalt már kiemelted.' })),
];
awakening.scenes['awakening:panel-detail'].environment!.find(entity => entity.id === 'awakening:panel-contacts')!.descriptionVariants = [{ requires: opened, text: 'VISSZA és HANG. A két érintkező közötti vonal most végig világít. „HANGMINTA ELFOGADVA” – áll a panelen; a zár nyitva van.' }];

// Interaction metadata is content, not a list of suggested solutions in the UI.
for (const scene of Object.values(awakening.scenes)) for (const rule of scene.rules) {
  if (rule.interaction) continue;
  const [verb, first, second] = rule.id.split(':');
  if (rule.id === 'look:room') { rule.interaction = { verb: 'look' }; continue; }
  if (verb === 'look') {
    rule.interaction = { verb: 'look', target: { kind: 'environment', id: first === 'hall' ? 'hall-window' : first } };
    rule.requires = { ...rule.requires, discoveries: [first === 'hall' ? 'hall-window' : first] };
  } else if (verb === 'take') {
    rule.interaction = { verb: 'take', target: { kind: 'environment', id: 'loose-' + first } };
    rule.requires = { ...rule.requires, discoveries: ['loose-' + first] };
  } else if (verb === 'use') {
    rule.interaction = { verb: 'use', item: first, target: { kind: 'environment', id: second } };
    rule.requires = { ...rule.requires, discoveries: [second] };
  } else if (verb === 'combine') {
    rule.portable = true;
    rule.interaction = { verb: 'combine', item: first, target: { kind: 'item', id: second } };
    rule.label = 'Kombinálás';
  } else if (verb === 'talk' || verb === 'attack') {
    rule.interaction = { verb, target: { kind: 'environment', id: 'speaker' }, ...(first === 'identity' || first === 'help' ? { topic: first } : {}) };
    rule.requires = { ...rule.requires, discoveries: ['speaker'] };
  } else if (verb === 'move') {
    rule.interaction = { verb: 'move', target: { kind: 'exit', id: first === 'chamber' ? 'chamber' : 'door' } };
    if (first !== 'chamber') rule.requires = { ...rule.requires, discoveries: ['door'] };
    if (first === 'threshold') rule.discover = ['hall-window'];
  }
}

// The close-up contacts are the same physical panel, not a separate mechanism.
// Reuse effects and state-aware feedback, but keep targeting local to this view.
for (const rule of awakening.scenes.chamber.rules.filter(rule => rule.interaction?.verb === 'use' && rule.interaction.target?.id === 'panel')) {
  awakening.scenes['awakening:panel-detail'].rules.push({
    ...rule,
    id: rule.id + ':contacts',
    requires: { ...rule.requires, discoveries: ['awakening:panel-contacts'] },
    interaction: { ...rule.interaction!, target: { kind: 'environment', id: 'awakening:panel-contacts' } },
  });
}

// This local departure procedure closes the awakening episode, not the story.
// Published archive/relay routes and historical milestone IDs remain untouched.
const aw = (name: string) => `awakening:${name}`;
const awTarget = (name: string) => ({ kind: 'environment' as const, id: aw(name) });
const awPhase = (flags: string[] = [], withoutFlags: string[] = []): Requirement => ({ flags: flags.map(aw), withoutFlags: withoutFlags.map(aw) });
const awEnv = (name: string, label: string, description: string, requires?: Requirement) => ({ id: aw(name), label, description, requires });
const awExit = (name: string, label: string) => ({ id: aw(name), label });
const awLook = (name: string, message: string, extra: Partial<Rule> = {}): Rule => ({ id: aw(`look:${name}`), kind: 'look', label: 'Megvizsgálom', interaction: { verb: 'look', target: awTarget(name) }, requires: { discoveries: [aw(name)] }, message, ...extra });
const awUse = (name: string, suffix: string, message: string, extra: Partial<Rule> = {}): Rule => ({ id: aw(`use:${name}:${suffix}`), kind: 'use', label: 'Működtetem', interaction: { verb: 'use', target: awTarget(name) }, requires: { discoveries: [aw(name)] }, message, ...extra });
const awMove = (name: string, destination: string, message: string, requires?: Requirement): Rule => ({ id: aw(`move:${name}`), kind: 'move', label: 'Továbbmegyek', interaction: { verb: 'move', target: { kind: 'exit', id: aw(name) } }, moveTo: destination, message, requires });
const wingDoor = { flags: ['door-open'] };
const flowOpen = awPhase(['flow-latched']);
const reviewed = awPhase(['flow-latched', 'sources-accepted']);
const closed = awPhase(['chapter-closed']);
awakening.goals = [
  { text: 'Vizsgáld meg a papírt oldalról jövő fényben. A gépházon át a vízkörhöz is visszatérhetsz.', rooms: [aw('light-room')], requires: awPhase(['wing-entered'], ['flow-latched', 'chapter-closed']) },
  { text: 'Nyisd ki az iratellenőrző ajtaját a vízkör kézi vezérlésével.', rooms: ['threshold', aw('cloakroom'), aw('water-room')], requires: awPhase(['wing-entered'], ['flow-latched', 'chapter-closed']) },
  { text: 'Olvasd el a műhelyben lévő papírt, majd készíts saját feljegyzést az iratpultnál.', rooms: ['threshold', aw('cloakroom'), aw('water-room'), aw('light-room'), aw('source-room')], requires: awPhase(['flow-latched'], ['sources-accepted', 'chapter-closed']) },
  { text: 'A kijárati pultnál döntsd el, milyen megjegyzéssel indulsz tovább az archívumba. A nevedet nem kell megadnod.', rooms: ['threshold', aw('cloakroom'), aw('water-room'), aw('light-room'), aw('source-room'), aw('decision-room')], requires: awPhase(['sources-accepted'], ['chapter-closed']) },
  { text: 'Menj vissza a körfolyosóra. Az ablak melletti keskeny átjárón léphetsz be az archívumba.', rooms: ['threshold', aw('cloakroom'), aw('water-room'), aw('light-room'), aw('source-room'), aw('decision-room')], requires: awPhase(['chapter-closed']) },
];
Object.assign(awakening.items, { [aw('frame')]: 'Réses nézőkeret', [aw('prism')]: 'Tejüveg prizma', [aw('viewer')]: 'Súrlófényes nézőke', [aw('source-card')]: 'Háromoszlopos forráslap' });
Object.assign(awakening.itemDescriptions!, {
  [aw('frame')]: 'Könnyű, rugós keret, közepén keskeny rés. A belső perem háromszögű bevágásába egy kis optikai hasáb illene. Nem vezetéket rögzít: a fény irányítására való.',
  [aw('prism')]: 'Tejfehér optikai hasáb, sima, háromszögű talppal. Az egyik éle végig átlátszó. Oldalsó fényben a tenyered apró barázdái sötét árkoknak látszanak alatta. Keret nélkül is átnézhetsz rajta.',
  [aw('viewer')]: 'A tejüveg hasábot a réses keret rögzíti. Így könnyebben irányíthatod az oldalról érkező fényt. Nem vetít képet, csak jobban láthatóvá teszi a megvilágított felületet.',
  [aw('source-card')]: 'Vékony lap, három oszlopban lyukakkal. SZEMLE: amit most megfigyelhetsz. KÖZLÉS: amit valaki mond, vagy egy felirat állít. HIÁNY: amiről nincs adat. A lap nem mondja meg, igaz-e egy állítás; azt segít jelölni, honnan származik.',
});
Object.assign(awakening.itemArt!, itemArts(['awakening:frame', 'awakening:prism', 'awakening:viewer', 'awakening:source-card']));

// Inspection, not a permanent marker, reveals the maintenance hatch.
awakening.scenes.threshold.environment!.push(awEnv('departure-trace', 'Mellékajtó és útjelző', 'Az alacsony ajtó mellett: GÉPÉSZET / IRATELLENŐRZÉS / KIJÁRAT. A padlón kopott talpnyomok fordulnak felé. Alatta egy régebbi mondat: „A NYITOTT AJTÓ NEM NYILATKOZAT”. Az ablak melletti archívumi átjáróhoz itt lehet hozzáférést kérni.'));
awakening.scenes.threshold.exits!.push({ ...awExit('wing-entry', 'Az alacsony mellékajtón át'), requires: { discoveries: [aw('departure-trace')] } });
const hallLook = awakening.scenes.threshold.rules.find(rule => rule.id === 'look:hall')!;
hallLook.discover = [...hallLook.discover ?? [], aw('departure-trace')];
hallLook.message += ' Az alacsony mellékajtó mellett útjelző: GÉPÉSZET / IRATELLENŐRZÉS / KIJÁRAT. Alatta: „A NYITOTT AJTÓ NEM NYILATKOZAT”. Az ablak melletti archívumi átjáró beléptetője a kijárati pulthoz irányít.';
awakening.scenes.threshold.rules.push(awMove('wing-entry', aw('cloakroom'), 'Csövek futnak be az alacsony ajtó fölött. Bent levetett munkaköpenyek, szerelőpad és két további munkahely felé mutató tábla fogad.', { discoveries: [aw('departure-trace')] }));
awakening.scenes.threshold.rules.at(-1)!.addFlags = [aw('wing-entered')];

awakening.scenes[aw('cloakroom')] = {
  title: 'I/a · Az ébresztőszobák gépháza', description: 'A mennyezeti csövek az ébresztőszobák felé ágaznak. A falon levetett munkaköpenyek, alattuk szerelőpad; balra nyitott ajtó mögött a vízkör üveghengerei csobognak. Jobbra az iratok vizsgálatához használt műhely nyílik. Szemben acél tolóajtó zárja el az iratpultot és a kijáratot. A zárhoz az üveghengerektől rudazat fut. A körfolyosó ajtaja nyitva maradt.', requires: wingDoor,
  arrivalDiscoveries: ['coats', 'departure-board'].map(aw),
  environment: [awEnv('coats', 'Munkaköpenyek és szerelőpad', 'A köpenyeket kifordítva hagyták a vállfákon. A szerelőpad alsó lécein tisztább négyszög látszik.'), awEnv('departure-board', 'Útjelző a kijárathoz', 'A tábla a helyiségek rendjét mutatja: VÍZ — FÉNY — FORRÁS — DÖNTÉS. A vízkörből rudazat vezet az iratpult ajtajához; a műhelyben papírt lehet vizsgálni, a pultnál saját feljegyzést készíteni. Az archívumba a kijárati pult enged tovább. Alul: „A NYITOTT AJTÓ NEM NYILATKOZAT”. Egy régi mondatot áthúztak: „A hallgatás beleegyezés.” Nem látszik, ki húzta át.'), awEnv('loose-frame', 'Pad alatti keret', 'Lapos, réses keret fekszik a pad alsó lécein. Háromszögű fészke üres; a rugós perem még ép.', awPhase([], ['frame-taken']))],
  exits: [awExit('wing-back', 'Vissza a körfolyosóra'), awExit('water', 'A vízkör vezérléséhez'), awExit('light', 'Az iratvizsgáló műhelybe'), awExit('sorting', 'Az iratpulthoz')],
  ...bindScene('awakening:cloakroom'),
  rules: [awLook('coats', 'Az üres köpenyek alatt a pad alsó lécein lapos nézőkeret fekszik. Közepén rés, a belső peremén háromszögű bevágás. A köpenyek címkéit üresen hagyták.', { discover: [aw('loose-frame')], messageVariants: [{ requires: awPhase(['frame-taken']), text: 'Az üres köpenyek alatt a pad lécei is üresek. A keretet már kiemelted innen; a porban megmaradt a tiszta négyszög.' }] }),
    { id: aw('take:frame'), kind: 'take', label: 'Felveszem', interaction: { verb: 'take', target: awTarget('loose-frame') }, requires: { discoveries: [aw('loose-frame')], ...awPhase([], ['frame-taken']) }, addItems: [aw('frame')], addFlags: [aw('frame-taken')], message: 'A réses keretet kihúzod a pad alól. A rugó megfeszül az ujjad alatt, aztán visszaáll.' },
    { id: aw('combine:viewer'), kind: 'combine', label: 'Kombinálás', portable: true, interaction: { verb: 'combine', item: aw('frame'), target: { kind: 'item', id: aw('prism') } }, requires: { items: [aw('frame'), aw('prism')] }, removeItems: [aw('frame'), aw('prism')], addItems: [aw('viewer')], addFlags: [aw('viewer-made')], message: 'A tejüveg hasáb a háromszögű fészekbe illik. Rácsukod a keret rugós peremét. A keskeny rés egyenesen vezeti a súrlófényt; a nézőke egy kézben tartható.' },
    awMove('wing-back', 'threshold', 'Visszalépsz a körfolyosóra. A 90-es ajtó mögött továbbra is az eredeti ébresztőszoba áll.'), awMove('water', aw('water-room'), 'A csobbanás két egymás melletti üveghengerből jön. A kifolyók nyitott gyűjtővályúba torkollnak.'), awMove('light', aw('light-room'), 'A műhely lámpája egy fehér papírlapot világít meg.'), awMove('sorting', aw('source-room'), 'Az acélajtót külön retesz tartja félrehúzva. Mögötte iratpult vár, rajta három feljegyzés helyével.', flowOpen),
    { ...awMove('sorting', aw('source-room'), 'Az acélajtó nem mozdul. A zár rudazata a bal oldali helyiség üveghengereihez fut; az úszók most zárt helyzetben tartják.', awPhase([], ['flow-latched'])), id: aw('move:sorting:closed'), moveTo: undefined },
  ],
};

const volumes = (large: number, small: number): Requirement => awPhase([...(large ? [`large-${large}`] : []), ...(small ? [`small-${small}`] : [])], [...[1, 2, 3].filter(n => n !== large).map(n => `large-${n}`), ...[1, 2].filter(n => n !== small).map(n => `small-${n}`)]);
const volumeFlags = ['large-1', 'large-2', 'large-3', 'small-1', 'small-2'].map(aw);
const waterTarget = ' A nyitókar melletti ábrán a víz a hosszú henger második rovátkájánál áll, a rövid henger pedig üres. Felirata: „KÉT EGYSÉG TERHELÉS / ÜRES VISSZATÉRŐ”.';
awakening.scenes[aw('water-room')] = {
  title: 'I/b · A vízkör kézi vezérlése', description: 'Az ébresztőszobák felől érkező vízcső itt két üveghengerhez fut. A hosszú három, a rövid két egységet fogad be; a rovátkák térfogatot jelölnek, nem nyomást. A felső csap csak a hosszút tölti. A két forgatható csőrrel átöntheted a vizet, alul külön ürítőkarok vezetnek a nyitott lefolyóvályúba. A hengerek úszórúdjai az iratpult acélajtajának reteszéhez kapcsolódnak. Mellette ábra mutatja a kézi nyitáshoz szükséges úszóállást.', requires: wingDoor,
  arrivalDiscoveries: ['vessels', 'fill', 'empty-large', 'empty-small', 'pour-small', 'pour-large', 'float-test'].map(aw),
  environment: [awEnv('vessels', 'Rovátkás üveghengerek', 'A hosszú hengeren három, a röviden két egyenlő térfogatot jelölő rovátka. Az átöntés addig tart, amíg az egyik kiürül vagy a másik megtelik. A csap mindig tele tölti a hosszút; nincs külön csap a rövid fölött.'), awEnv('fill', 'Felső töltőcsap', 'Az ébresztőszobák vízköréhez csatlakozó felső csap a hosszú hengert a harmadik rovátkáig tölti. A túlfolyó nem engedi magasabbra a vizet.'), awEnv('empty-large', 'Hosszú henger ürítője', 'A hosszú henger alján széles kar. Lenyomására a víz a lefolyóvályúba fut.'), awEnv('empty-small', 'Rövid henger ürítője', 'A rövid henger alján keskeny kar. A kifolyó közvetlenül a lefolyóvályú fölött áll.'), awEnv('pour-small', 'A rövid felé forduló csőr', 'A csőr a hosszú hengerből a rövidbe vezet. A peremen kicsi nyíl követi a víz útját.'), awEnv('pour-large', 'A hosszú felé forduló csőr', 'A másik csőr a rövid hengerből a hosszúba fordul. A két henger közti víz így visszaönthető.'), awEnv('float-test', 'Kézi nyitókar', 'Az ábra a hosszú hengerben két egység vizet, a rövidben üres visszatérőt mutat. Alatta: „KÉT EGYSÉG TERHELÉS / ÜRES VISSZATÉRŐ”. A víz színén úszók járnak; rúdjaikon bevágások vannak. A kar ezek között húzhatja ki az ajtó reteszét, ha mindkét bevágás a megfelelő magasságba kerül. A kar nem változtat a vízmennyiségen.'), awEnv('loose-prism', 'Úszóházban fekvő hasáb', 'A nyitott úszóház belső párkányán tejfehér, háromszögű optikai hasáb ül. Nem a zár része; a rudaktól külön, egy elszíneződött folton fekszik.', awPhase(['flow-latched'], ['prism-taken']))],
  exits: [awExit('water-back', 'Vissza a gépházba')],
  ...bindScene('awakening:water-room'), rules: [],
};
const water = awakening.scenes[aw('water-room')];
water.descriptionVariants = [];
for (let large = 0; large <= 3; large++) for (let small = 0; small <= 2; small++) {
  const requires = volumes(large, small);
  const waterText = `A hosszú üveghengerben ${large}, a rövidben ${small} egység víz van. A hosszúba három, a rövidbe két egység fér; ezt jelölik a rovátkák. Felül töltőcsap, a hengerek között átöntőcsőrök vannak. Az alsó ürítők a nyitott lefolyóvályúba vezetnek. Az úszók rúdjai az iratpult acélajtajának reteszéhez kapcsolódnak.`;
  water.descriptionVariants.push({ requires: { ...requires, flags: [...requires.flags!, aw('flow-latched')] }, text: waterText + waterTarget + ' Az ajtót már külön rögzítő tartja nyitva; a víz átállítása nem zárja vissza.' }, { requires, text: waterText + waterTarget });
  water.rules.push(awLook('vessels', `A hosszú hengerben ${large}, a rövidben ${small} egység víz van. A hosszúba összesen három, a rövidbe két egység fér. Átöntéskor addig folyik a víz, amíg az egyik henger kiürül, vagy a másik megtelik.` + waterTarget, { id: aw(`look:vessels:${large}:${small}`), requires }));
  for (const [name, nextLarge, nextSmall] of [
    ['fill', 3, small], ['empty-large', 0, small], ['empty-small', large, 0],
    ['pour-small', large - Math.min(large, 2 - small), small + Math.min(large, 2 - small)],
    ['pour-large', large + Math.min(small, 3 - large), small - Math.min(small, 3 - large)],
  ] as const) water.rules.push(awUse(name, `${large}:${small}`, nextLarge === large && nextSmall === small ? 'A víz nem mozdul: a henger már üres, a másik tele van, vagy a kívánt szintet már elérted.' : `${name === 'fill' ? 'A felső csapból víz folyik a hosszú hengerbe.' : name.startsWith('empty') ? 'Az ürítőből a víz a lefolyóvályúba csorog.' : 'A nyitott csőrön át a víz az egyik hengerből a másikba csobban.'} A hosszú hengerben most ${nextLarge}, a rövidben ${nextSmall} egység áll.`, { requires, removeFlags: volumeFlags, addFlags: [...(nextLarge ? [aw(`large-${nextLarge}`)] : []), ...(nextSmall ? [aw(`small-${nextSmall}`)] : [])] }));
}
water.rules.push(
  awUse('float-test', 'latched', 'Az acélajtót már külön retesz tartja nyitva. A vízszinteket tovább próbálgathatod; az átjáró nem záródik vissza.', { requires: flowOpen }),
  awUse('float-test', 'balanced', 'Lenyomod a kart. A hosszú henger úszója a második rovátkánál, a rövidé az alján áll: a rudak bevágásai a reteszhez igazodnak. A kar most ki tudja húzni a zár nyelvét. Az acélajtó félrecsúszik, külön rögzítő akad be mögé. Az úszóház szerelőfedele is felbillen; a belső párkányon tejfehér optikai hasáb fekszik.', { requires: { ...volumes(2, 0), withoutFlags: [...volumes(2, 0).withoutFlags!, aw('flow-latched')] }, addFlags: [aw('flow-latched')], discover: [aw('loose-prism')], notes: ['A hosszú hengerben két egység vízzel és üres rövid hengerrel az úszórudak engedték kihúzni az acélajtó reteszét. Külön rögzítő tartja nyitva.'] }),
  awUse('float-test', 'unbalanced', 'A nyitókar megakad az úszórudak egyikén, ezért visszaengeded. Az ábrán a hosszú henger második rovátkájánál van a vízjel, a rövid alatt száraz vonal; a mostani úszóállás ettől eltér. A vízen nem változtatott a próbálkozás.', { requires: awPhase([], ['flow-latched']) }),
  { id: aw('take:prism'), label: 'Felveszem', kind: 'take', interaction: { verb: 'take', target: awTarget('loose-prism') }, requires: { discoveries: [aw('loose-prism')], ...awPhase(['flow-latched'], ['prism-taken']) }, addItems: [aw('prism')], addFlags: [aw('prism-taken')], message: 'A tejüveg prizmát kiemeled az úszóház belső párkányáról. A rudazat nem mozdul; a hasáb csak itt volt eltéve.' },
  awMove('water-back', aw('cloakroom'), 'A víz a hengerekben marad. A gépház küszöbén újra hallod a körfolyosó távoli hangjait.'),
);
awakening.scenes[aw('cloakroom')].descriptionVariants = [
  { requires: { ...flowOpen, flags: [...flowOpen.flags!, aw('frame-taken')] }, text: 'Az ébresztőszobák csövei alatt munkaköpenyek lógnak; a pad alól már kivetted a keretet. Az iratpult acélajtaját külön retesz tartja nyitva. Balra a vízkör vezérlése, jobbra az iratvizsgáló műhely, hátul a körfolyosó nyitott ajtaja.' },
  { requires: flowOpen, text: 'Az ébresztőszobák csövei alatt munkaköpenyek lógnak a szerelőpad fölött. Az iratpult acélajtaját külön retesz tartja nyitva. Balra a vízkör vezérlése, jobbra az iratvizsgáló műhely, hátul a körfolyosó nyitott ajtaja.' },
];

awakening.scenes[aw('light-room')] = {
  title: 'I/c · Az iratvizsgáló műhely', description: 'Itt a papíron maradt benyomódásokat vizsgálhatták: a fekete munkapad fölött forgatható lámpa, előtte árnyékoló áll. Alattuk fehér dombornyomat fekszik, szemből alig látható vonalakkal. A falon a fény terelésének rajza: háromszögű hasáb, réses keret és fényesre hajlított fólia. A sín végén csipesz fog egy kisebb lapot; a kioldófüle a papír alá nyúlik.', requires: wingDoor,
  arrivalDiscoveries: ['lamp', 'shutter', 'relief', 'optics-note'].map(aw),
  environment: [awEnv('lamp', 'Háromállású munkalámpa', 'A munkalámpa állásai: SZEMBŐL, FÖLÜLRŐL, OLDALRÓL. Minden fordítás a következő ütközőhöz viszi. A világítás nem időzített.'), awEnv('shutter', 'Forgó árnyékoló', 'A fekete lemez nyitott állásban elengedi a fényt, zárt állásban árnyékot vet a munkapadra. A tengelyre fényes félkört karcoltak.'), awEnv('relief', 'Fehér dombornyomat', 'A fehér papírba sekély vájatokat préseltek. Szemből a vonalak elvesznek a fényben. Nem a betűk hiányoznak: a mélységüket kell láthatóvá tenni.'), awEnv('optics-note', 'Fényút rajza', 'A rajzon oldalról érkező fény vet árnyékot a sekély vájatokban. Egy kéz átlátszó élű hasábbal keskenyíti a fénysávot; mellette réses keret tartja ugyanazt. A másik ábrán meghajlított, fényes fólia tükrözi a lapra a lámpa fényét. Ehhez a hurok végére hajtott fólia is elég; nem kell szétszedni. Egyik eszköz sem segít oldalról jövő fény nélkül. A felirat: „ANYAGI NYOM / NEM SZERZŐSÉGI IGAZOLÁS”.'), awEnv('loose-source-card', 'Csipesszel rögzített forráslap', 'A csipesz még fogja a keskeny lapot. Három oszlopa: SZEMLE, KÖZLÉS, HIÁNY. A peremén lyukak illenek az iratpult tüskéire. A dombornyomaton látható nyíl a csipesz kioldófülét mutatja.', awPhase(['relief-read'], ['card-taken']))],
  exits: [awExit('light-back', 'Vissza a gépházba')],
  ...bindScene('awakening:light-room'), rules: [],
};
const light = awakening.scenes[aw('light-room')];
light.descriptionVariants = [
  { requires: awPhase(['card-taken']), text: 'A munkapadon a nagy dombornyomat maradt, fölötte a forgatható lámpa és árnyékoló. A kisebb forráslapot már kivetted; a sín végén nyitott, üres csipesz áll. A falon továbbra is látszik a hasáb és a fényes fólia fényútjának rajza.' },
  { requires: awPhase(['relief-read']), text: 'A papír jelkulcsát már elolvastad: SZEMLE, KÖZLÉS, HIÁNY. A sín végén a kisebb forráslapot még csipesz fogja. Most már látod a kioldófülhöz vezető nyilat is; a fül megnyomásával kiveheted a lapot. A lámpa és árnyékoló tovább állítható.' },
];
const angles = ['SZEMBŐL', 'FÖLÜLRŐL', 'OLDALRÓL'];
const anglePhase = (angle: number) => awPhase(angle ? [`angle-${angle}`] : [], [1, 2].filter(n => n !== angle).map(n => `angle-${n}`));
for (let angle = 0; angle < 3; angle++) {
  const next = (angle + 1) % 3;
  light.rules.push(awUse('lamp', String(angle), `A lámpa a következő ütközőhöz fordul: ${angles[next]}.`, { requires: anglePhase(angle), removeFlags: [aw('angle-1'), aw('angle-2')], addFlags: next ? [aw(`angle-${next}`)] : [] }));
  light.rules.push(awLook('lamp', `A lámpa jelenlegi állása: ${angles[angle]}. A másik két ütköző is elérhető; egy fordítás a következő állásra vált.`, { id: aw(`look:lamp:${angle}`), requires: anglePhase(angle) }));
}
light.rules.push(awUse('shutter', 'open', 'Az árnyékolót elfordítod a fény útjából. A fekete lemez élére áll.', { requires: awPhase([], ['shutter-open']), addFlags: [aw('shutter-open')] }), awUse('shutter', 'close', 'A fekete árnyékoló visszafordul a lap elé.', { requires: awPhase(['shutter-open']), removeFlags: [aw('shutter-open')] }));
const reliefMilestone = { id: aw('source-visible'), title: 'A nyom nem vallomás', text: 'Oldalról vezettem fényt a fehér papírra. A sekély vájatok nem titkos üzenetté, hanem rendezett jelkulccsá álltak össze: szemle, közlés, hiány. A rajz külön figyelmeztetett, hogy az anyagi nyom nem igazolja a szerzőjét. Az új eszközzel a papír felszínét láttam jobban; a múltba nem nyílt ablak.' };
for (const item of ['prism', 'viewer', 'foil', 'bridge']) {
  const pattern = { verb: 'use' as const, item: ['foil', 'bridge'].includes(item) ? item : aw(item), target: awTarget('relief') };
  light.rules.push({ id: aw(`use:${item}:relief:repeat`), label: 'Használom', kind: 'use', interaction: pattern, requires: awPhase(['relief-read']), message: 'Már ismered a papír jelkulcsát: SZEMLE — amit most megfigyelhetsz; KÖZLÉS — amit valaki mond, vagy egy felirat állít; HIÁNY — amiről nincs adat. Akkor is emlékszel rá, ha azóta elállítottad a fényt.' });
  light.rules.push({ id: aw(`use:${item}:relief:read`), label: 'Használom', kind: 'use', interaction: pattern, requires: awPhase(['angle-2', 'shutter-open'], ['relief-read']), addFlags: [aw('relief-read')], discover: [aw('loose-source-card')], milestone: reliefMilestone, notes: ['A forrásjelkulcs három oszlopa: SZEMLE — megfigyelhető; KÖZLÉS — állítás; HIÁNY — nincs adat. Nem hitelesít szerzőséget.'], message: `${['foil', 'bridge'].includes(item) ? 'A fólia fényes oldalát kissé meghajlítod, és a lámpa oldalsó fényét keskeny sávban a papírra tükrözöd.' : `A ${item === 'viewer' ? 'keretben tartott hasáb' : 'kézben tartott prizma'} átlátszó élével keskeny sávba tereled az oldalról érkező fényt.`} A vájatok széle árnyékot vet: SZEMLE — JELENBEN MEGFIGYELHETŐ. KÖZLÉS — VALAKI VAGY EGY FELIRAT ÁLLÍTÁSA. HIÁNY — NINCS ADAT. Alul: ANYAGI NYOM / NEM SZERZŐSÉGI IGAZOLÁS. A vonalak között előtűnik a csipesz kioldófüléhez vezető nyíl is. A kisebb lapot a fül megnyomásával húzhatod ki.` });
  light.rules.push({ id: aw(`use:${item}:relief:dark`), label: 'Használom', kind: 'use', interaction: pattern, message: 'A papírra csak szórt fény jut. Az eszköz nem pótolja az oldalról érkező világítást: a vájatoknak most nincs éles árnyéka. A lámpa és az árnyékoló állásán láthatod, hol akad el a fény.' });
}
light.rules.push({ id: aw('take:source-card'), label: 'Felveszem', kind: 'take', interaction: { verb: 'take', target: awTarget('loose-source-card') }, requires: { discoveries: [aw('loose-source-card')], ...awPhase(['relief-read'], ['card-taken']) }, addItems: [aw('source-card')], addFlags: [aw('card-taken')], message: 'Megnyomod a kioldófület, felemeled a csipeszt, és kihúzod alóla a háromoszlopos forráslapot. A nagy dombornyomat a helyén marad; a sín végén már csak az üres csipesz áll.' }, awMove('light-back', aw('cloakroom'), 'Kilépsz a műhelyből. A papír, a lámpa és az árnyékoló az általad hagyott állásban marad.'));
light.environment!.find(entity => entity.id === aw('relief'))!.descriptionVariants = [{ requires: awPhase(['relief-read']), text: 'A fehér papírba préselt jelkulcsot már elolvastad: SZEMLE — amit most megfigyelhetsz; KÖZLÉS — amit valaki mond, vagy egy felirat állít; HIÁNY — amiről nincs adat. A lámpa állásától függetlenül emlékszel rá.' }];

awakening.scenes[aw('source-room')] = {
  title: 'I/d · Az iratpult', description: 'A pultnál saját feljegyzést készíthetsz arról, amit az ébresztőszobában megtudtál. Három papírcsík fut állítható jelölőtárcsák alatt: a csuklód kilenc hege, az ajtófeliraton állított önkéntesség és a hiányzó név. Középen három rögzítőtüske várja a műhely oszlopmintáját. A falon: „FORRÁST JELÖLJ, NE IGAZSÁGOT”. A továbbvezető ajtó zárját az asztal melletti leadókar mozgatja.', requires: flowOpen,
  arrivalDiscoveries: ['card-bed', 'wrist-source', 'claim-source', 'name-source', 'source-check'].map(aw),
  environment: [awEnv('card-bed', 'Rögzítőtüskék', 'A három eltérő távolságú tüskére a műhelyben talált forráslap illik. A lyukak a papírcsíkok oszlopait igazítják a jelölőkhöz. Nincs érzékelő vagy névolvasó: ez egyszerű papírvezető szerkezet.'), awEnv('wrist-source', 'A csukló megfigyelésének jelölője', 'Az első papírcsíkon: „A csuklómon kilenc heg látszik.” Magad elé fordítod a kezed: a kilenc apró heg most is ott van. A SZEMLE itt saját megfigyelést jelent. A hegek meglétét rögzíted, nem azt, ki és mikor ejtette őket.'), awEnv('claim-source', 'Az önkéntesség állításának jelölője', 'A második csíkon: „A karantén önkéntes volt — a 09-es ajtó felirata szerint.” A feliratot láttad, a múltbeli beleegyezésre nem emlékszel. Ezt csak a felirat állításaként tudod feljegyezni.'), awEnv('name-source', 'Üres névmező jelölője', 'A harmadik lapon a NÉV mező üres. Nem adtak hozzá nevet, aláírást vagy ellenőrizhető azonosítót. Az üres hely nem egy személy neve.'), awEnv('source-check', 'A feljegyzés leadókarja', 'A kar a jelölők alatti papírcsíkokat az oszlopminta résein át húzza a gyűjtőkapocsba. Ha a szélek nincsenek a megfelelő oszlophoz igazítva, megakadnak. A szerkezet csak a lapokat illeszti össze; nem tudja eldönteni, mi történt veled. A feljegyzést te készíted, a kar az ajtó reteszét is oldja.')],
  exits: [awExit('source-back', 'Vissza a gépházba'), awExit('decision', 'A kijárati pulthoz')],
  ...bindScene('awakening:source-room'), rules: [],
};
const source = awakening.scenes[aw('source-room')];
source.rules.push({ id: aw('use:source-card'), kind: 'use', label: 'Használom', interaction: { verb: 'use', item: aw('source-card'), target: awTarget('card-bed') }, addFlags: [aw('card-registered')], removeItems: [aw('source-card')], notes: ['A forráslapot a rögzítőtüskéken hagytam; a lyukak a papírvezetőket igazítják. A lapot nem hordom tovább.'], message: 'A forráslapot a három tüskére illeszted. A lyukakon át beállítod a papírvezetőket a SZEMLE, KÖZLÉS és HIÁNY oszlopához. A lap a tüskéken marad: a lyukak pontosan a vezetőket igazítják, és a további állításokhoz nem kell kézben tartani. A vezetők ebben a helyzetben maradnak.' });
const sourceNames = ['HIÁNY', 'SZEMLE', 'KÖZLÉS'];
const sourcePhase = (name: string, position: number) => awPhase(position ? [`${name}-${position}`] : [], [1, 2].filter(n => n !== position).map(n => `${name}-${n}`));
for (const name of ['wrist-source', 'claim-source', 'name-source'] as const) {
  for (let position = 0; position < 3; position++) {
    const next = (position + 1) % 3, state = sourcePhase(name, position);
    source.rules.push(awUse(name, String(position), `A jelölő a következő forrásfajtára fordul: ${sourceNames[next]}.`, { requires: { ...state, flags: [...state.flags!, aw('card-registered')] }, removeFlags: [aw(`${name}-1`), aw(`${name}-2`)], addFlags: next ? [aw(`${name}-${next}`)] : [] }));
  }
  source.rules.push(awUse(name, 'no-card', 'A jelölőt egy keresztléc fogja. Előbb a középső három tüskénél kell beállítani a papírvezetőket a forráslap oszlopaihoz.', { requires: awPhase([], ['card-registered']) }));
  source.environment!.find(entity => entity.id === aw(name))!.descriptionVariants = [0, 1, 2].map(position => ({ requires: sourcePhase(name, position), text: `${source.environment!.find(entity => entity.id === aw(name))!.description} A tárcsa jelenlegi állása: ${sourceNames[position]}.` }));
}
source.rules.push(
  awUse('source-check', 'repeat', 'A leadott feljegyzés külön kapocsban maradt, az ajtót retesz tartja nyitva. Ha tovább forgatod a jelölőket, már új papírcsíkokat állítasz be; a leadott lap nem változik meg.', { requires: awPhase(['sources-accepted']) }),
  awUse('source-check', 'accept', 'A csuklód kilenc hege a SZEMLE, az önkéntesség állítása a KÖZLÉS oszlopába került; a név helyén HIÁNY marad. Lenyomod a kart. A három papírcsík széle átcsúszik az egymáshoz igazított réseken, a feljegyzés a gyűjtőkapocsba kerül. A kar végállásában kiold a kijárati pult ajtaja. Nem a múltat igazoltad: azt írtad le, honnan tudod ezt a keveset.', { requires: awPhase(['card-registered', 'wrist-source-1', 'claim-source-2'], ['name-source-1', 'name-source-2', 'sources-accepted']), addFlags: [aw('sources-accepted')], milestone: { id: aw('sources-separated'), title: 'Amit láttam, amit állítottak', text: 'Saját feljegyzést készítettem. A kilenc heg a csuklómon megfigyelhető volt. Az önkéntes karantén az ajtó állítása maradt. A nevem helyén pedig továbbra sem volt adat. A három papírcsíkot a megfelelő oszlopokhoz igazítottam, és a karral a gyűjtőkapocsba húztam. A kijárati pult ajtaja kinyílt. A szerkezet a papírt rendezte el, nem a múltamat döntötte el helyettem.' } }),
  awUse('source-check', 'no-card', 'A kar előtt keresztléc áll: a papírvezetőket még nem állítottad be a forráslap segítségével.', { requires: awPhase([], ['card-registered']) }),
  awUse('source-check', 'mismatch', 'A papírcsíkok széle fennakad az oszlopminta résein. Visszaengeded a kart, a lapok sértetlenek. A csuklód kilenc hegét magad látod; a korábbi önkéntesség csak a felirat állítása; a névhez nincs adat. Ezeket kell külön oszlophoz igazítanod.', { requires: awPhase(['card-registered'], ['sources-accepted']) }),
  awMove('source-back', aw('cloakroom'), 'Visszatérsz a csövek és a szerelőpad közé. Az acélajtó nyitva marad.'), awMove('decision', aw('decision-room'), 'A kijárati pult az archívumi átjáró beléptetőjéhez csatlakozik. Két kar és egy keskeny papírablak van rajta; névmezőt nem látsz.', reviewed),
  { ...awMove('decision', aw('decision-room'), 'Az ajtó retesze még zárva van. Az iratpult leadókarjától fut hozzá rudazat.', awPhase([], ['sources-accepted'])), id: aw('move:decision:closed'), moveTo: undefined },
);
source.descriptionVariants = [{ requires: awPhase(['sources-accepted']), text: 'A leadott feljegyzésedet a gyűjtőkapocs tartja. A kijárati pult ajtaját külön retesz rögzíti nyitott állásban. A jelölőkkel most új papírcsíkokat állíthatsz be; a korábbi lap nem változik meg. A három kérdés ugyanaz: a csuklód kilenc hege, az ajtó önkéntességről szóló felirata és a hiányzó neved. A falon: FORRÁST JELÖLJ, NE IGAZSÁGOT.' }];
source.descriptionVariants.push(
  { requires: { ...awPhase(['card-registered'], ['sources-accepted']), withoutItems: [aw('source-card')] }, text: 'A papírvezetők már a forráslap oszlopaihoz igazodnak. A tüskék mellett a SZEMLE, KÖZLÉS és HIÁNY jelei látszanak; a forráslap a tüskéken maradt. A csuklód kilenc hegéről, az állított önkéntességről és az üres névmezőről szóló papírcsíkok a jelölőkkel állíthatók. A falon: FORRÁST JELÖLJ, NE IGAZSÁGOT. A kijárati pult ajtaja még zárva van.' },
  { requires: awPhase(['card-registered'], ['sources-accepted']), text: 'A papírvezetők már a forráslap oszlopaihoz igazodnak. A tüskék mellett a SZEMLE, KÖZLÉS és HIÁNY jelei látszanak; a lapot a zsebedben hordod. A csuklód kilenc hegéről, az állított önkéntességről és az üres névmezőről szóló papírcsíkok a jelölőkkel állíthatók. A falon: FORRÁST JELÖLJ, NE IGAZSÁGOT. A kijárati pult ajtaja még zárva van.' },
);
source.environment!.find(entity => entity.id === aw('card-bed'))!.descriptionVariants = [
  { requires: { ...awPhase(['card-registered']), withoutItems: [aw('source-card')] }, text: 'A papírvezetőket a forráslap szerint beállítottad. A tüskék mellett a SZEMLE, KÖZLÉS és HIÁNY jelei látszanak: pontpár, kettőspont és vízszintes vonás. A lap a tüskéken maradt. A jelölők a papírcsíkokat az oszlopokhoz igazítják; aláírást vagy személyazonosságot itt semmi nem vizsgál.' },
  { requires: awPhase(['card-registered']), text: 'A papírvezetőket a forráslap szerint beállítottad. A tüskék mellett a SZEMLE, KÖZLÉS és HIÁNY jelei látszanak: pontpár, kettőspont és vízszintes vonás. A lapot visszatetted a zsebedbe. A jelölők a papírcsíkokat az oszlopokhoz igazítják; aláírást vagy személyazonosságot itt semmi nem vizsgál.' },
];

awakening.scenes[aw('decision-room')] = {
  title: 'I/e · A kijárati pult', description: 'A pult kábele az archívumi átjáró beléptetőjéhez fut. Két karja van: TOVÁBBMEGYEK és FENNTARTÁSSAL. Bármelyikkel kérhetsz továbbhaladást; egyik sem kér nevet. A falon: „JELENLEGI DÖNTÉS / NEM MÚLTBELI HOZZÁJÁRULÁS”. A papírablak üres. Az iratpulthoz és a körfolyosóra vezető visszaút nyitva áll.', requires: reviewed,
  arrivalDiscoveries: ['departure-plain', 'departure-reserved', 'departure-copy'].map(aw),
  environment: [awEnv('departure-plain', 'Továbbmegyek kar', 'A kar mellett: „TOVÁBBMEGYEK — JELENLEGI SAJÁT DÖNTÉS”. Lenyomása hozzáférést kér az archívumi átjáróhoz. Csak a mostani továbbhaladást rögzíti: nem állítja, hogy a korábbi bezárás önkéntes volt, és nem töröl emléket.'), awEnv('departure-reserved', 'Továbbmegyek, fenntartással kar', 'A másik kar felirata: „TOVÁBBMEGYEK, A KORÁBBI ÖNKÉNTESSÉGET NEM IGAZOLOM”. Ugyanúgy megnyitja az archívumi átjárót, de a papíron külön megőrzi ezt a megjegyzést. Egyik választás sem mond többet a múltadról, mint amennyit tudsz. A kar megvizsgálása még nem döntés.'), awEnv('departure-copy', 'Papírablak', 'A keskeny ablak mögött üres tartó áll. A felirat: „HELYI KILÉPÉSI BEJEGYZÉS”. Ide a mostani továbbhaladásodról kerül lap; ez nem emléktörlési kérelem és nem az archívum teljes iratanyaga.')],
  exits: [awExit('decision-back', 'Vissza a források asztalához'), awExit('departure-return', 'Vissza a körfolyosóra')],
  ...bindScene('awakening:decision-room'), rules: [awMove('decision-back', aw('source-room'), 'Visszalépsz az iratpulthoz. A már leadott feljegyzésed a kapocsban marad.'), { ...awMove('departure-return', 'threshold', 'Újra a tizenkét ajtó körfolyosóján állsz. Az ébresztőszoba ajtaja nyitva, az archívumi átjáró még zárva van: a kijárati pultnál kérhetsz hozzáférést. A mellékágba bármikor visszatérhetsz.'), messageVariants: [{ requires: closed, text: 'Újra a tizenkét ajtó körfolyosóján állsz. Az ébresztőszoba ajtaja nyitva, az archívum útja járható. Az ablak melletti keskeny átjárón léphetsz be. A mellékágba bármikor visszatérhetsz.' }] }],
};
const decision = awakening.scenes[aw('decision-room')];
for (const [name, choice, statement] of [['departure-plain', 'plain', 'TOVÁBBMEGYEK — JELENLEGI SAJÁT DÖNTÉS'], ['departure-reserved', 'reserved', 'TOVÁBBMEGYEK, A KORÁBBI ÖNKÉNTESSÉGET NEM IGAZOLOM']] as const) {
  decision.rules.push(awUse(name, 'record', `Lenyomod a kart. A papírablakban megjelenik: „${statement}”. Alatta: „HELYI KILÉPÉSI BEJEGYZÉS RÖGZÍTVE”. A beléptető visszajelzője kigyullad: az archívumi átjáró most már enged tovább. Menj vissza a körfolyosóra, és keresd az ablak melletti keskeny átjárót. A nevedet nem kellett megadnod; a többi hang eredetét ez nem magyarázza meg.`, { requires: awPhase([], ['chapter-closed']), addFlags: [aw('chapter-closed'), aw(`departure-${choice}`)], milestone: { id: aw(`closure-${choice}`), title: 'Ébren maradni', text: `A kijárati pultnál nem kértek nevet. Lenyomtam a kart: „${statement}”. Ez a mostani döntésem volt, nem vallomás arról, amit nem tudtam felidézni. A beléptető megnyitotta az archívumi átjárót. A hideg szobát és a tizenegy zárt ajtót magam mögött hagyhattam, de vissza is térhettem hozzájuk. A nevemet továbbra sem tudtam. Az archívumban akartam utánajárni annak, ami velem történt.` } }));
  decision.rules.push(awUse(name, 'repeat', 'A papírablakban már ott áll a korábbi döntésed. A kar visszaenged, új lap nem készül. Az archívumi átjáró nyitva marad; a korábbi választásodat ez a próba nem írja át.', { requires: closed }));
}
decision.environment!.find(entity => entity.id === aw('departure-copy'))!.descriptionVariants = [
  { requires: awPhase(['departure-reserved']), text: 'A papírablakban a saját mostani döntésed áll: „TOVÁBBMEGYEK, A KORÁBBI ÖNKÉNTESSÉGET NEM IGAZOLOM”. A beléptető engedi a továbbhaladást az archívumba. A korábbi iratok nem változtak meg.' },
  { requires: awPhase(['departure-plain']), text: 'A papírablakban a saját mostani döntésed áll: „TOVÁBBMEGYEK — JELENLEGI SAJÁT DÖNTÉS”. A beléptető engedi a továbbhaladást az archívumba. A korábbi iratok nem változtak meg.' },
];
decision.descriptionVariants = [{ requires: closed, text: 'A két kar visszaengedett alaphelyzetbe. A papírablak a már meghozott döntésedet őrzi, a beléptető jelzője világít. Az archívumba a körfolyosó ablak melletti átjáróján juthatsz be. A falon továbbra is: JELENLEGI DÖNTÉS / NEM MÚLTBELI HOZZÁJÁRULÁS. Mindkét visszaút nyitva maradt.' }];

// A walk around the same corridor, not eleven speculative new rooms.
const otherDoors = [
  ['left-near', 'Balra az első ajtó', 'A saját nyitott ajtód mellett ez az első zárt ajtó. A számtábláját innen nem tudod elolvasni; a keret keskeny árnyékot vet rá.', 'A koppantás röviden visszaverődik a közeli sarokról. A hang beszél tovább, de a hívásodra nem kapsz felismerhető választ.'],
  ['left-second', 'Balra a második ajtó', 'A folyosó ívén a második zárt ajtónál állsz. A címke felszíne megcsillan, a számát nem tudod biztosan kivenni.', 'Bekopogsz és beszólsz. A beszéd a kopogás alatt is hallatszik; nem tudod megállapítani, reagált-e rád bárki.'],
  ['left-middle', 'Balra a harmadik ajtó · 80', 'A folyosó ívének közepén álló ajtón a 80-as szám olvasható. Az ajtó zárva, mögé nem látsz be.', 'A 80-as ajtó mögül a saját hangodat hallod. Beszólsz, majd vársz. A beszéd folytatódik, de nem hallasz benne neked szóló választ.'],
  ['left-fourth', 'Balra a negyedik ajtó', 'A negyedik ajtó táblája ferdén kapja a fényt. A feliratát nem tudod biztosan kiolvasni.', 'Kopogásod után egy pillanatra a szomszéd ajtó felől hallatszik tisztábban a beszéd. Nem tudod, melyik hang honnan jön.'],
  ['left-far', 'Balra az ötödik ajtó', 'Ez az utolsó ajtó balra, a szemközti előtt. A számtábla szélét látod, de a szám árnyékban marad.', 'A kopogás visszhangja hosszan végigfut a folyosó túlsó ívén. Választ nem tudsz kivenni a beszédből.'],
  ['opposite', 'A szemközti ajtó', 'A nyitott szobáddal szemben állsz. A zárt ajtó két oldalán ugyanakkora falsáv marad; a számtábla innen sem olvasható tisztán.', 'Megszólalsz az ajtó előtt. Innen egyszerre több irányból hallod a saját hangodat; nem derül ki, van-e valaki közvetlenül a túloldalon.'],
  ['right-far', 'Jobbra az ötödik ajtó', 'A jobb oldali ív legtávolabbi ajtaja a szemközti mellett áll. Zárt illesztése mögé nem látsz; a tábláját nem tudod elolvasni.', 'Bekopogsz. A fém tompán felel, a mögüle hallatszó beszédben nem ismersz fel választ.'],
  ['right-fourth', 'Jobbra a negyedik ajtó', 'Az ajtó a jobb ív belső kanyarulatában áll. A táblán megcsillan a fény; a számot nem tudod kivenni.', 'Beszólsz, majd elhallgatsz. A folyosó hangjai folytatódnak; nem tudod megmondani, hallottak-e.'],
  ['right-middle', 'Jobbra a harmadik ajtó · 70', 'A tábla ezen az ajtón 70-et mutat. A folyosói szám nem árulja el, mi van a túloldalon.', 'A 70-es ajtón kopogsz. Egy ismerős hangú mondat vége átszűrődik, de nem válaszként hangzik el.'],
  ['right-second', 'Jobbra a második ajtó', 'Innen már közel van a saját ajtód. Ennek az ajtónak a tábláján megcsillan a fény, a számot nem tudod elolvasni.', 'Beszólsz az ajtón. Mögüle a saját hangodat hallod, változatlan ritmusban. Nem tudod eldönteni, kitől vagy mitől jön.'],
  ['right-near', 'Jobbra az első ajtó', 'A nyitott 90-es ajtód jobb oldali szomszédja. A számtábla rossz szögben áll a fényhez; a zárt ajtón nem látsz nyitott rést.', 'Bekopogsz, és vársz a két ajtó között. A hang áthallatszik, de nem kapsz biztos választ. A saját szobádba továbbra is visszamehetsz.'],
] as const;
awakening.scenes.threshold.arrivalDiscoveries!.push(aw('hall-doors'));
awakening.scenes.threshold.environment!.push(awEnv('hall-doors', 'A körfolyosó többi ajtaja', 'A saját, nyitott 90-es ajtóddal együtt tizenkét ajtó nyílik a körfolyosóra. A másik tizenegyet végigjárhatod: a helyük alapján megkülönböztethetők, de nem mindegyik táblája olvasható. A hangokból nem derül ki, hányan vannak mögöttük, vagy honnan ered a beszéd.'));
awakening.scenes.threshold.rules.push(awLook('hall-doors', 'Végigindulsz a körfolyosón. A saját 90-es ajtód nyitva marad; a másik tizenegy zárva. Mindegyikhez odaléphetsz, megpróbálhatod kinyitni, és be is szólhatsz rajta.', { focusTo: aw('corridor-doors') }));
awakening.scenes[aw('corridor-doors')] = {
  detailOf: 'threshold', title: 'A körfolyosó · tizenegy zárt ajtó',
  ...bindScene('awakening:corridor-doors'),
  description: 'A nyitott 90-es ajtódtól balra és jobbra öt-öt zárt ajtó sorakozik a folyosó ívén; a tizenegyedik veled szemben áll. Csak a 70-es és a 80-as számot tudod biztosan elolvasni. A hangok összemosódnak. Az ajtók mögé nem látsz be, így azt sem tudod, van-e ott valaki.',
  arrivalDiscoveries: otherDoors.map(([name]) => aw(`hall-door-${name}`)),
  environment: otherDoors.map(([name, label, description]) => awEnv(`hall-door-${name}`, label, description)),
  rules: otherDoors.flatMap(([name, , description, response]) => {
    const door = `hall-door-${name}`;
    return [awLook(door, description), awUse(door, 'open', 'Az ajtó szélénél próbálod megmozdítani a fémlapot. Nem enged; ezen az oldalon nincs kilincs vagy nyitógomb. Visszalépsz a folyosóra.'),
      { id: aw(`talk:${door}`), label: 'Beszólok és kopogok', kind: 'talk' as const, interaction: { verb: 'talk' as const, target: awTarget(door) }, requires: { discoveries: [aw(door)] }, message: response }];
  }),
};

// A second, physical source tests the old claim without turning a machine log
// into a personal confession. Existing milestones retain their historical text.
const lockRecord = 'A külön tartóban a vízkör zárjegyzékének átnyomatát találod; az eredeti a szerelőfedél mögött van. A fejléc: „BELSŐ 09 / ZÁRJEGYZÉK”. Nyolc korábbi ciklusnál a BELSŐ KÉZI oszlopban látszik mély jel. Mellette külön oszlopot kapott a KÜLSŐ ÉBRESZTÉS. A metszetrajzon is külön vezetéken fut a két jel. A mostani állapot: NYITVA. A jegyzék szerint az ajtót nyolcszor belülről, kézzel zárták be, nem az ébresztés zárta automatikusan. Név vagy aláírás nincs a csíkon: azt továbbra sem tudod, ki kezelte a zárat, és volt-e választása.';
const lockMilestone = { id: aw('lock-record-read'), title: 'A belső jel', text: 'Az iratpult külön tartójában a szerelőfedél mögötti zárjegyzék átnyomatát olvastam. Nyolc lezárt ciklusnál belső kézi bemenetet jelölt, külön a külső ébresztéstől. A mostani kimenet nyitott volt. Már nem csak az ajtó feliratára és egy hangra támaszkodhattam: a helyi berendezés is őrizte a belső zárás nyomát. Azt azonban nem jegyezte fel, ki kezelte, és milyen körülmények között. A belső zárás nem lett ettől önkéntes beleegyezés.' };
water.environment!.push(awEnv('lock-record', 'Zárjegyzék a szerelőfedél mögött', 'A felnyílt szerelőfedél mögött külön papírcsík fut: „BELSŐ 09 / ZÁRJEGYZÉK”. Nyolc régi sorban BELSŐ KÉZI zárójel áll, a KÜLSŐ ÉBRESZTÉS külön oszlop. A jelenlegi kimenet NYITVA. A csík rögzített, nem a prizma tartozéka. A gép a bemenet helyét őrizte meg, nem a kezelő nevét vagy szándékát.', flowOpen));
water.arrivalDiscoveries!.push(aw('lock-record'));
const openCover = water.rules.find(rule => rule.id === aw('use:float-test:balanced'))!;
openCover.discover!.push(aw('lock-record'));
openCover.message += ' A fedél mögött külön zárjegyzék is látszik: nyolc régi BELSŐ KÉZI zárójel, a külső ébresztéstől elkülönítve. Az iratpult falán ennek átnyomatát rögzítették.';
water.rules.push(awLook('lock-record', water.environment!.at(-1)!.description!, { requires: flowOpen, addFlags: [aw('lock-log-seen')] }));
for (const variant of water.descriptionVariants!) if (variant.requires.flags?.includes(aw('flow-latched'))) variant.text += ' A szerelőfedél nyitva maradt; mögötte a külön BELSŐ 09 zárjegyzék nyolc régi belső kézi zárójele és a mostani NYITVA kimenet látszik.';
source.environment!.push(awEnv('lock-rubbing', 'Zárjegyzék és a két bemenet metszete', lockRecord));
source.arrivalDiscoveries!.push(aw('lock-rubbing'));
source.description += ' ' + lockRecord;
for (const variant of source.descriptionVariants!) variant.text += ' ' + lockRecord;
source.rules.push(awLook('lock-rubbing', lockRecord, { addFlags: [aw('lock-record-read')], milestone: lockMilestone, messageVariants: [{ requires: awPhase(['lock-record-read']), text: 'A külön tartóban változatlanul a nyolc belső kézi zárójel és a NYITVA kimenet átnyomata áll. A KÜLSŐ ÉBRESZTÉS külön bemeneten fut; a jegyzék továbbra sem nevezi meg a kezelőt, és nem igazol beleegyezést.' }] }));
const enterSource = awakening.scenes[aw('cloakroom')].rules.find(rule => rule.id === aw('move:sorting'))!;
enterSource.message += ' ' + lockRecord;
enterSource.addFlags = [aw('lock-record-read')];
enterSource.milestone = lockMilestone;
enterSource.messageVariants = [{ requires: awPhase(['lock-record-read']), text: 'A nyitott acélajtón át az iratpulthoz lépsz vissza. A külön tartóban a nyolc belső kézi zárójel átnyomata maradt; a három régi forráscsíkot nem cserélték le.' }];
const departureDataPath = ' A papírablaktól keskeny sín vezet az archívumi beléptetőhöz. Ezen továbbítják a mostani kilépésedről készült kísérőlapot; a régi iratok változatlanok maradnak.';
decision.description += departureDataPath;
for (const variant of decision.descriptionVariants!) variant.text += departureDataPath;
const departureCopy = decision.environment!.find(entity => entity.id === aw('departure-copy'))!;
departureCopy.description += departureDataPath;
for (const variant of departureCopy.descriptionVariants!) variant.text += departureDataPath;
for (const rule of decision.rules.filter(rule => rule.id.endsWith(':record'))) rule.message += departureDataPath;
