import type { Chapter } from '../types.ts';

export const INTRO = 'Hideg padlón ébredsz. A szoba üresnek tűnik: egy fekvőlap, egy ajtó és egy néma falpanel. Nincs ablak. Nincs emlék. A falon halvány felirat: ÉV 7314 / ÉBRESZTÉS 09. A csuklódon kilenc apró heg. Valahonnan a saját hangodat hallod: „Ha újra felébredsz, ne mondd meg nekik a neved.”';
export const OPENING_ENTRY = { id: 'awakening:wake', chapter: 'I. Az ébredés', title: 'A kilencedik ébredés', text: 'A hideg volt az első emlékem. Nem egy arc, nem egy név: a padló hidege az arcom alatt. Amikor kinyitottam a szememet, az üres szoba falán a 7314-es évszám derengett. A csuklómon kilenc heg sorakozott. Aztán meghallottam a saját hangomat, bár a szám nem mozdult. Arra kért, ne mondjam meg nekik a nevemet. Egyelőre nem is tudtam volna.', turn: 0 };
const description = 'A hideg fényben egy fekvőlap, egy zárt ajtó és egy falpanel rajzolódik ki. A mennyezeten egy apró hangszóró figyel.';
export const awakening: Chapter = {
  id: 'awakening', title: 'I. Az ébredés',
  items: { foil: 'Vezető fólia', wire: 'Szigetelt huzal', bridge: 'Áthidaló hurok' },
  itemDescriptions: { foil: 'A fólia vékony és puha. Apró, szabályos bemélyedések futnak a felületén, mint egy hang hullámai.', wire: 'Rövid, hajlítható huzal. A szigetelés ép, csak a két végén látszik csupasz fém.', bridge: 'A kész hurok könnyedén elfér a tenyeredben. A fólián lévő mintázat most szabályos körbe zárul.' },
  itemArt: { foil: ' .------.\n/_.._../\n\'-----\'', wire: '   __\n__/  \\__\n       /', bridge: ' .----.\n( .--. )\n \'----\'' },
  scenes: {
    chamber: { title: '01 · Az üres szoba', description,
      arrivalDiscoveries: ['bed', 'panel', 'door', 'speaker'],
      environment: [{ id: 'bed', label: 'Fekvőlap' }, { id: 'panel', label: 'Falpanel' }, { id: 'door', label: 'Ajtó' }, { id: 'speaker', label: 'Hangszóró', description: 'A mennyezeti rács mögött egyetlen membrán ül. A peremére apró betűkkel ezt vésték: ŐR–0. A beszéd előtt halk kattanás hallatszik belőle.' },
        { id: 'loose-foil', label: 'Fóliadarab', description: 'A perem alá szorult ezüstös lap széle felpöndörödött. A felületén finom, szabályos barázdák futnak; amikor megérinted, megőrzi az ujjad melegét.', requires: { withoutItems: ['foil', 'bridge'] } }, { id: 'loose-wire', label: 'Huzaldarab', description: 'Rövid, sötét szigetelésű huzal fekszik a burkolat résében. A végein csupasz fém csillan, a közepe enyhe ívben meghajlott.', requires: { withoutItems: ['wire', 'bridge'] } }],
      exits: [{ id: 'door', label: 'Az ajtó felé', requires: { discoveries: ['door'] } }],
      topics: [{ id: 'identity', label: 'Ki vagyok?', target: 'speaker', requires: { flags: ['voice-heard'] } }, { id: 'help', label: 'A kijutásról', target: 'speaker', requires: { flags: ['voice-heard'] } }],
      artSpots: [
        { id: 'bed', environment: 'bed', row: 14, col: 10, width: 30, height: 6, actions: ['look','attack'] },
        { id: 'panel', environment: 'panel', row: 8, col: 35, width: 15, height: 5, actions: ['look','attack'] },
        { id: 'door', environment: 'door', exit: 'door', row: 4, col: 58, width: 15, height: 17, actions: ['look','attack'] },
        { id: 'speaker', environment: 'speaker', row: 4, col: 10, width: 15, height: 4, actions: ['look','talk','attack'] },
        { id: 'loose-foil', environment: 'loose-foil', row: 21, col: 14, width: 10, height: 3, glyph: ' .------.\n/_.._../\n\'-----\'', actions: ['look','take'] },
        { id: 'loose-wire', environment: 'loose-wire', row: 16, col: 40, width: 11, height: 3, glyph: '   __\n__/  \\__\n       /', actions: ['look','take'] },
      ],
      art: [
        '        ______________________________________________________________________',
        '       /                                                                     /|',
        '      /_____________________________________________________________________/ |',
        '      |                                                                     | |',
        '      |   .----------.                                    .------------.    | |',
        '      |   |  (  )    |                                    |            |    | |',
        '      |   \'----------\'                                    |     09     |    | |',
        '      |                                                   |            |    | |',
        '      |                            .----------.           |            |    | |',
        '      |                            |   o  o   |           |    [  ]    |    | |',
        '      |                            |  .----.  |           |            |    | |',
        '      |                            |  \'----\'  |           |            |    | |',
        '      |                            \'----------\'           |            |    | |',
        '      |                                                   |            |    | |',
        '      |    .------------------------.                     |            |    | |',
        '      |   /________________________/|                     |            |    | |',
        '      |   |                        ||                     |            |    | |',
        '      |   |________________________|/                     |            |    | |',
        '      |     |  |              |  |                        |            |    | /',
        '      |     |__|              |__|                        \'------------\'    |/',
        '      |                                                                     /',
        '      |                                                                    /',
        '      |                                                                   /',
        '      |                                                                  /',
        '      |                                                                 /',
        '      |________________________________________________________________/',
        '                      EBRESZTES 09 / EV 7314',
        '',
      ].join('\n'), rules: [
      { id: 'look:room', label: 'Körülnézek', kind: 'look', discover: ['bed', 'panel', 'door', 'speaker'], message: description + ' A fekvőlap pereme felpúposodott. A panel felől gyenge zúgás hallatszik.' },
      { id: 'look:bed', label: 'Megvizsgálom a fekvőlapot', kind: 'look', addFlags: ['bed-seen'], message: 'A fekvőlap kemény, hideg vizsgálóasztal. A felpúposodott perem alatt lapos mélyedés fut. A fémbe karcolva: „A zár nem kulcsot kér. Visszhangot.”', notes: ['A fekvőlapba karcolva: „A zár nem kulcsot kér. Visszhangot.”'] },
      { id: 'look:panel', label: 'Megvizsgálom a falpanelt', kind: 'look', addFlags: ['panel-seen'], message: 'A panel matt burkolatán két kopott felirat áll: VISSZA és HANG. Alattuk eltérő szélességű érintkezők csillannak. A burkolat résében keskeny vájat húzódik. Egy halvány vonal körbefut a két fémfelület körül, aztán megszakad.', notes: ['A falpanelen VISSZA és HANG felirat, két eltérő szélességű érintkező és egy megszakadó vonal látszik.'] },
      { id: 'look:door', label: 'Megvizsgálom az ajtót', kind: 'look', message: 'Az ajtón nincs kilincs. A paneltől egy kábel vezet a zárhoz. A szám alatt pici betűk: „BELSŐ KARANTÉN / ÖNKÉNTES”. Önkéntes?', notes: ['A szoba ajtaján: „Belső karantén / önkéntes”.'] },
      { id: 'take:foil', label: 'Felveszem a fóliát', kind: 'take', requires: { flags: ['bed-seen'], withoutItems: ['foil', 'bridge'] }, addItems: ['foil'], message: 'A fekvőlap pereme alól kihúzod a vezető fóliát. A tenyeredben melegszik, mintha felismerne.' },
      { id: 'take:wire', label: 'Felveszem a huzalt', kind: 'take', requires: { flags: ['panel-seen'], withoutItems: ['wire', 'bridge'] }, addItems: ['wire'], message: 'A falpanel nyitott vájatából kiemelsz egy rövid huzalt. A szigetelése ép, de a végein nincs érintkezőfelület.' },
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
      { id: 'move:threshold', label: 'Kilépek a folyosóra', kind: 'move', requires: { flags: ['door-open'] }, moveTo: 'threshold', message: 'Kilépsz. Tizenkét ajtó, tizenkét azonos szoba. Mindegyikben a te hangod beszél, egy másodperc eltéréssel. A kijelzőn: „EGYETLEN SZEMÉLYZETI TAG AKTÍV.”', notes: ['Tizenkét szobából a saját hangom hallatszik. A rendszer mégis egyetlen személyt lát.'], milestone: { id: 'awakening:threshold', title: 'Tizenkét hang, egyetlen ember', text: 'Kiléptem a körfolyosóra. Tizenkét szobából hallottam a saját hangomat, mindegyikből egy másodperc késéssel. A rendszer egyetlen aktív személyzeti tagról tudott. Visszanéztem az ajtómra: kívülről 90-es számot viselt, nem 09-est. A válaszok helyett egy nagyobb rejtélybe jutottam. A folyosó végén valami lassan mozdult az üveg mögött.' } },
    ] },
    threshold: { title: '02 · A küszöb', description: 'A körfolyosó falán számozott ajtók sorakoznak. Az üveg mögött lassan elmozdulnak a fényes jelek.', arrivalDiscoveries: ['hall-window'], requires: { flags: ['door-open'] },
      environment: [{ id: 'hall-window', label: 'Folyosó ablaka' }], exits: [{ id: 'chamber', label: 'Vissza a szobába' }],
      artSpots: [{ id: 'return', exit: 'chamber', row: 4, col: 10, width: 16, height: 13 }, { id: 'window', environment: 'hall-window', row: 7, col: 43, width: 29, height: 12, actions: ['look'] }],
      art: [
        '       ______________________________________________________________________',
        '      /        /        /        /        /        /        /               /|',
        '     /________/________/________/________/________/________/_______________/ |',
        '     |                                                                    | |',
        '     |    .------------.       .--------.      .--------.                 | |',
        '     |    |            |       |   08   |      |   07   |                 | |',
        '     |    |     90     |       |________|      |________|                 | |',
        '     |    |            |                   .--------------------------.   | |',
        '     |    |            |                   | .                      . |   | |',
        '     |    |    [  ]    |                   |      .       .           |   | |',
        '     |    |            |                   |   .               .      |   | |',
        '     |    |            |                   |           .              |   | |',
        '     |    |            |                   | .     .             .    |   | |',
        '     |    |            |                   |                          |   | |',
        '     |    |            |                   |        ARCHIVUM          |   | |',
        '     |    |            |                   |                          |   | |',
        '     |    \'------------\'                   \'--------------------------\'   | /',
        '     |                                                                    |/',
        '     |     . . . . . . . . . . . . . . . . . . . . . . . . . . . .       /',
        '     |                                                                   /',
        '     |                                                                  /',
        '     |                                                                 /',
        '     |                                                                /',
        '     |                                                               /',
        '     |______________________________________________________________/',
        '                        NEM VAGY EGYEDUL',
        '',
        '',
      ].join('\n'), rules: [
      { id: 'look:hall', label: 'Megnézem a folyosót', kind: 'look', message: 'Az üvegen túl nem csillagok látszanak, hanem lassan mozgó betűk. Egy mondat újra és újra összeáll: „AZ ARCHÍVUM NEM A MÚLTAT ŐRZI.”', notes: ['Az archívum nem a múltat őrzi.'] },
      { id: 'move:chamber', label: 'Visszamegyek a szobába', kind: 'move', moveTo: 'chamber', message: 'Visszatérsz a szobába. Az ajtó nyitva marad, ŐR–0 vár.' },
    ] },
  },
};

// Interaction metadata is content, not a list of suggested solutions in the UI.
for (const scene of Object.values(awakening.scenes)) for (const rule of scene.rules) {
  const [verb, first, second] = rule.id.split(':');
  if (rule.id === 'look:room') { rule.interaction = { verb: 'look' }; continue; }
  if (verb === 'look') {
    rule.interaction = { verb: 'look', target: { kind: 'environment', id: first === 'hall' ? 'hall-window' : first } };
    rule.requires = { ...rule.requires, discoveries: [first === 'hall' ? 'hall-window' : first] };
    if (first === 'bed') rule.discover = ['loose-foil'];
    if (first === 'panel') rule.discover = ['loose-wire'];
  } else if (verb === 'take') {
    rule.interaction = { verb: 'take', target: { kind: 'environment', id: 'loose-' + first } };
    rule.requires = { ...rule.requires, discoveries: ['loose-' + first] };
  } else if (verb === 'use') {
    rule.interaction = { verb: 'use', item: first, target: { kind: 'environment', id: second } };
    rule.requires = { ...rule.requires, discoveries: [second] };
  } else if (verb === 'combine') {
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
