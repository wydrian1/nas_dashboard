import type { ArtSpot, Chapter, Requirement, Rule } from '../types.ts';

export const INTRO = 'Hideg padlón ébredsz. A szoba üresnek tűnik: egy fekvőlap, egy ajtó és egy néma falpanel. Nincs ablak. Nincs emlék. A falon halvány felirat: ÉV 7314 / ÉBRESZTÉS 09. A csuklódon kilenc apró heg. Valahonnan a saját hangodat hallod: „Ha újra felébredsz, ne mondd meg nekik a neved.”';
export const OPENING_ENTRY = { id: 'awakening:wake', chapter: 'I. Az ébredés', title: 'A kilencedik ébredés', text: 'A hideg volt az első emlékem. Nem egy arc, nem egy név: a padló hidege az arcom alatt. Amikor kinyitottam a szememet, az üres szoba falán a 7314-es évszám derengett. A csuklómon kilenc heg sorakozott. Aztán meghallottam a saját hangomat, bár a szám nem mozdult. Arra kért, ne mondjam meg nekik a nevemet. Egyelőre nem is tudtam volna.', turn: 0 };
const description = 'A hideg fényben egy fekvőlap, egy zárt ajtó és egy falpanel rajzolódik ki. A mennyezeten egy apró hangszóró figyel. A falon: ÉBRESZTÉS 09 / ÉV 7314.';
export const awakening: Chapter = {
  id: 'awakening', title: 'I. Az ébredés',
  items: { foil: 'Vezető fólia', wire: 'Szigetelt huzal', bridge: 'Áthidaló hurok' },
  itemDescriptions: { foil: 'A fólia vékony és puha. Apró, szabályos bemélyedések futnak a felületén, mint egy hang hullámai.', wire: 'Rövid, hajlítható huzal. A szigetelés ép, csak a két végén látszik csupasz fém.', bridge: 'A kész hurok könnyedén elfér a tenyeredben. A fólián lévő mintázat most szabályos körbe zárul.' },
  itemArt: { foil: ' .------.\n/_.._../\n\'-----\'', wire: '   __\n__/  \\__\n       /', bridge: ' .----.\n( .--. )\n \'----\'' },
  scenes: {
    chamber: { title: '01 · Az üres szoba', description,
      arrivalDiscoveries: ['bed', 'panel', 'door', 'speaker'],
      environment: [{ id: 'bed', label: 'Fekvőlap' }, { id: 'panel', label: 'Falpanel' }, { id: 'door', label: 'Ajtó' }, { id: 'speaker', label: 'Hangszóró', description: 'A mennyezeti rács mögött egyetlen membrán ül. A peremére apró betűkkel ezt vésték: ŐR–0. A beszéd előtt halk kattanás hallatszik belőle.' }],
      exits: [{ id: 'door', label: 'Az ajtó felé', requires: { discoveries: ['door'] } }],
      topics: [{ id: 'identity', label: 'Ki vagyok?', target: 'speaker', requires: { flags: ['voice-heard'] } }, { id: 'help', label: 'A kijutásról', target: 'speaker', requires: { flags: ['voice-heard'] } }],
      artSpots: [
        { id: 'bed', environment: 'bed', row: 14, col: 10, width: 30, height: 6, actions: ['look','attack'] },
        { id: 'panel', environment: 'panel', row: 8, col: 35, width: 15, height: 5, actions: ['look','attack'] },
        { id: 'door', environment: 'door', exit: 'door', row: 4, col: 58, width: 15, height: 17, actions: ['look','attack'] },
        { id: 'speaker', environment: 'speaker', row: 4, col: 10, width: 15, height: 4, actions: ['look','talk','attack'] },
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
      { id: 'look:bed', label: 'Megvizsgálom a fekvőlapot', kind: 'look', addFlags: ['bed-seen'], focusTo: 'awakening:bed-detail', message: 'Közel hajolsz a hideg vizsgálóasztalhoz. A felszíne sima, de a felpúposodott perem árnyékában egy keskeny rés fut.' },
      { id: 'look:panel', label: 'Megvizsgálom a falpanelt', kind: 'look', addFlags: ['panel-seen'], focusTo: 'awakening:panel-detail', message: 'A matt burkolat közelről hajszálrepedéseket mutat. Két eltérő szélességű fémfelület és egy nyitott vájat rajzolódik ki.' },
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
      { id: 'move:threshold', label: 'Kilépek a folyosóra', kind: 'move', requires: { flags: ['door-open'] }, moveTo: 'threshold', message: 'Kilépsz. Tizenkét ajtó, tizenkét azonos szoba. Mindegyikben a te hangod beszél, egy másodperc eltéréssel. A kijelzőn: „EGYETLEN SZEMÉLYZETI TAG AKTÍV.”', notes: ['Tizenkét szobából a saját hangom hallatszik. A rendszer mégis egyetlen személyt lát.'], milestone: { id: 'awakening:threshold', title: 'Tizenkét hang, egyetlen ember', text: 'Kiléptem a körfolyosóra. Tizenkét szobából hallottam a saját hangomat, mindegyikből egy másodperc késéssel. A rendszer egyetlen aktív személyzeti tagról tudott. Visszanéztem az ajtómra: kívülről 90-es számot viselt, nem 09-est. A válaszok helyett egy nagyobb rejtélybe jutottam. A folyosó végén valami lassan mozdult az üveg mögött.' } },
    ] },
    threshold: { title: '02 · A küszöb', description: 'A körfolyosó falán számozott ajtók sorakoznak. Az üveg mögött lassan elmozdulnak a fényes jelek; rajta ARCHÍVUM felirat. Az ablak alatti sávon: „NEM VAGY EGYEDÜL”. A kijelző továbbra is egyetlen aktív személyzeti tagot jelez.', arrivalDiscoveries: ['hall-window'], requires: { flags: ['door-open'] },
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
      { id: 'look:hall', label: 'Megnézem a folyosót', kind: 'look', message: 'Az üvegen az ARCHÍVUM név, az ablak alatti sávon: „NEM VAGY EGYEDÜL”. Ez egy felirat, nem bizonyíték arra, ki lehet még itt; a kijelző egyetlen aktív személyzeti tagot jelez. Az üvegen túl nem csillagok látszanak, hanem lassan mozgó betűk. Egy mondat újra és újra összeáll: „AZ ARCHÍVUM NEM A MÚLTAT ŐRZI.”', notes: ['Az archívum nem a múltat őrzi.', 'A folyosó felirata: „NEM VAGY EGYEDÜL”; a kijelző mégis egyetlen aktív személyzeti tagot jelez.'] },
      { id: 'move:chamber', label: 'Visszamegyek a szobába', kind: 'move', moveTo: 'chamber', message: 'Visszatérsz a szobába. Az ajtó nyitva marad, ŐR–0 vár.' },
    ] },
    'awakening:bed-detail': {
      detailOf: 'chamber', title: 'Fekvőlap', description: 'A hideg fekvőlap közelnézete. A peremnél sötét rés, az egyik sarokban besüllyesztett rögzítő látszik.',
      arrivalDiscoveries: ['awakening:bed-rim-edge', 'awakening:bed-fastener'],
      environment: [
        { id: 'awakening:bed-rim-edge', label: 'Fekvőlap pereme' },
        { id: 'awakening:bed-fastener', label: 'Süllyesztett rögzítő', description: 'A csavar fejének mélyedése nem szabályos. Ugyanaz a rövid vonás kilencszer ismétlődik körülötte. A csavar maga nem mozog; a jelölések a fémet ért régebbi karcok.' },
      ],
      art: [
        '       ____________________________________________________________',
        '      /                                                           /|',
        '     /___________________________________________________________/ |',
        '     |                                                           | |',
        '     |            .---------------------------------.            | |',
        '     |            |                                 |            | |',
        '     |            |                                 |            | |',
        '     |            |                                 |            | |',
        '     |            |                                 |            | |',
        '     |            |                                 |            | |',
        '     |            |                                 |            | |',
        '     |            |                                 |            | |',
        '     |            \'---------------------------------\'            | |',
        '     |                                                           | |',
        '     |   ====================================================    | /',
        '     |   ----------------------------------------------------    |/',
        '     |                                                ( + )      /',
        '     |                                                          /',
        '     |                                                         /',
        '     |________________________________________________________/',
      ].join('\n'),
      artSpots: [
        { id: 'rim', environment: 'awakening:bed-rim-edge', row: 14, col: 9, width: 53, height: 2, actions: ['look'] },
        { id: 'fastener', environment: 'awakening:bed-fastener', row: 16, col: 52, width: 7, height: 2, actions: ['look'] },
      ],
      rules: [{ id: 'look:rim', label: 'Megnézem a perem alját', kind: 'look', focusTo: 'awakening:bed-rim', message: 'A résbe nézel. A fém alsó oldalán karcolás fut: „A zár nem kulcsot kér. Visszhangot.”', notes: ['A fekvőlapba karcolva: „A zár nem kulcsot kér. Visszhangot.”'], interaction: { verb: 'look', target: { kind: 'environment', id: 'awakening:bed-rim-edge' } } }],
    },
    'awakening:bed-rim': {
      detailOf: 'awakening:bed-detail', title: 'Perem alatti mélyedés', description: 'A fekvőlap pereme alatti keskeny mélyedés. A fém felszínén egy karcolás fut.',
      arrivalDiscoveries: ['loose-foil', 'awakening:bed-rim-mark'],
      environment: [
        { id: 'loose-foil', label: 'Fóliadarab', description: 'A perem alá szorult ezüstös lap széle felpöndörödött. A felületén finom, szabályos barázdák futnak; amikor megérinted, megőrzi az ujjad melegét.', requires: { withoutItems: ['foil', 'bridge'] } },
        { id: 'awakening:bed-rim-mark', label: 'Karcolás a perem alatt', description: '„A zár nem kulcsot kér. Visszhangot.” A betűket nem egy szerszám szabályos hegye vágta: egyes vonások mélyek, mások szinte eltűnnek. Az utolsó pont külön kis horpadás.' },
      ],
      art: [
        '     ______________________________________________________________',
        '    /_____________________________________________________________/|',
        '    |                                                             ||',
        '    |   .----------------------------------------------------.    ||',
        '    |   |                                                    |    ||',
        '    |   |                                                    |    ||',
        '    |   |                                                    |    ||',
        '    |   |                                                    |    ||',
        '    |   |                                                    |    ||',
        '    |   |                                                    |    ||',
        '    |   |                                / / / /  / /        |    ||',
        '    |   |                                /  / / / / / .      |    ||',
        '    |   |                                                    |    ||',
        '    |   |                                                    |    ||',
        '    |   \'----------------------------------------------------\'    |/',
        '    |_____________________________________________________________|',
      ].join('\n'),
      artSpots: [
        { id: 'foil', environment: 'loose-foil', row: 6, col: 13, width: 12, height: 4, glyph: ' .--------.\n/  _.._  /\n\'-------\'', actions: ['look', 'take'] },
        { id: 'mark', environment: 'awakening:bed-rim-mark', row: 10, col: 41, width: 20, height: 3, actions: ['look'] },
      ],
      rules: [{ id: 'take:foil', label: 'Felveszem a fóliát', kind: 'take', requires: { flags: ['bed-seen'], withoutItems: ['foil', 'bridge'] }, addItems: ['foil'], message: 'A fekvőlap pereme alól kihúzod a vezető fóliát. A tenyeredben melegszik, mintha felismerne.' }],
    },
    'awakening:panel-detail': {
      detailOf: 'chamber', title: 'Falpanel belseje', description: 'A falpanel közelnézete: két érintkező, a burkolat nyitott vájata és egy megszakadó vonal.',
      arrivalDiscoveries: ['loose-wire', 'awakening:panel-contacts'],
      environment: [
        { id: 'loose-wire', label: 'Huzaldarab', description: 'Rövid, sötét szigetelésű huzal fekszik a burkolat résében. A végein csupasz fém csillan, a közepe enyhe ívben meghajlott.', requires: { withoutItems: ['wire', 'bridge'] } },
        { id: 'awakening:panel-contacts', label: 'Érintkezők', description: 'VISSZA és HANG. A kopott feliratok alatt a fémfelületek különböző szélességűek. Egy halvány vonal körbefut közöttük, aztán megszakad. A keskenyebb érintkező szélén megolvadt fémpötty csillan.' },
      ],
      art: [
        '         ____________________________________________________',
        '        |                                                    |',
        '        |      VISSZA                      HANG              |',
        '        |                                                    |',
        '        |      .----.                   .----------.         |',
        '        |      |    |                   |          |         |',
        '        |      |    |                   |          |         |',
        '        |      \'----\'                   \'----------\'         |',
        '        |         :                          :               |',
        '        |         :............  ............:               |',
        '        |                                                    |',
        '        |                                                    |',
        '        |       .------------------------------------.       |',
        '        |       |                                    |       |',
        '        |       |                                    |       |',
        '        |       |                                    |       |',
        '        |       \'------------------------------------\'       |',
        '        |____________________________________________________|',
      ].join('\n'),
      artSpots: [
        { id: 'contacts', environment: 'awakening:panel-contacts', row: 2, col: 14, width: 40, height: 8, actions: ['look'] },
        { id: 'wire', environment: 'loose-wire', row: 13, col: 28, width: 16, height: 3, glyph: '    ____\n___/    \\___\n           /', actions: ['look', 'take'] },
      ],
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
awakening.scenes.chamber.artSpots!.find(spot => spot.id === 'door')!.glyphVariants = [{ requires: opened, text: '.------------.\n| 09 / NYITVA|\n|            |\n|  /         |\n| /          |\n|/           |\n|            |\n|            |\n|            |\n|            |\n|            |\n|            |\n|            |\n|            |\n|            |\n|            |\n\'------------\'' }];
awakening.scenes.chamber.artSpots!.find(spot => spot.id === 'panel')!.glyphVariants = [{ requires: opened, text: ".----------.\n|  *==*    |\n|  .----.  |\n|  ======  |\n'----------'" }];
awakening.scenes['awakening:panel-detail'].artSpots!.find(spot => spot.id === 'contacts')!.glyphVariants = [{ requires: opened, text: " VISSZA                      HANG\n\n .----.                   .----------.\n | ** |                   |  ******  |\n | ** |                   |  ******  |\n '----'                   '----------'\n    :                          :\n    :==========================:" }];

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
type WingMark = { name: string; row: number; col: number; glyph: string; width?: number; height?: number; exit?: boolean; actions?: ArtSpot['actions'] };
function wingPicture(caption: string, structure: [number, number, string][], marks: WingMark[]) {
  const lines = Array.from({ length: 30 }, (_, row) => row === 0 || row === 29 ? '+------------------------------------------------------------------------------+' : '|' + ' '.repeat(78) + '|');
  const write = (row: number, col: number, text: string) => { lines[row] = lines[row].slice(0, col) + text + lines[row].slice(col + text.length); };
  write(1, 3, caption);
  for (const [row, col, text] of structure) write(row, col, text);
  const artSpots: ArtSpot[] = marks.map(mark => ({ id: aw(`spot:${mark.name}`), ...(mark.exit ? { exit: aw(mark.name) } : { environment: aw(mark.name) }), row: mark.row, col: mark.col, width: mark.width ?? Math.max(...mark.glyph.split('\n').map(line => line.length)), height: mark.height ?? mark.glyph.split('\n').length, glyph: mark.glyph, ...(mark.exit ? {} : { actions: mark.actions ?? ['look'] }) }));
  return { art: lines.join('\n'), artSpots };
}
const wingDoor = { flags: ['door-open'] };
const flowOpen = awPhase(['flow-latched']);
const reviewed = awPhase(['flow-latched', 'sources-accepted']);
const closed = awPhase(['chapter-closed']);
awakening.goals = [
  { text: 'Végigjárni a körfolyosó melletti kilépési eljárást, és saját döntést hagyni a nyitott ajtó mellé.', requires: awPhase(['wing-entered'], ['chapter-closed']) },
  { text: 'Visszatérni a körfolyosóra; az archívum kérdései a kilépési bejegyzés után is nyitva maradnak.', requires: awPhase(['chapter-closed']) },
];
Object.assign(awakening.items, { [aw('frame')]: 'Réses nézőkeret', [aw('prism')]: 'Tejüveg prizma', [aw('viewer')]: 'Súrlófényes nézőke', [aw('source-card')]: 'Háromoszlopos forráslap' });
Object.assign(awakening.itemDescriptions!, {
  [aw('frame')]: 'Könnyű, rugós keret, közepén keskeny rés. A belső perem háromszögű bevágása pontosan egy kis optikai hasáb számára hagy helyet. A fém nem vezeték: a fényt tartja egyenesben.',
  [aw('prism')]: 'Tejfehér optikai hasáb. A háromszögű talpa sima, egyik éle végig átlátszó. Ha oldalról fényt kap, a tenyered bőrének apró vonalai sötét árkokká válnak. Önmagában is átnézhetsz rajta.',
  [aw('viewer')]: 'A tejüveg hasáb a réses keretbe pattant. A keret kényelmesen tartja a súrlófény útját; nem vetít képet és nem ír hozzá semmit ahhoz, amit megvilágítasz.',
  [aw('source-card')]: 'Vékony, három oszlopba lyukasztott lap. SZEMLE: jelenben megfigyelhető. KÖZLÉS: valaki vagy egy felirat állítása. HIÁNY: nincs rendelkezésre álló adat. A lap nem dönt egy állítás igazságáról: csak a forrásfajtát különíti el.',
});
Object.assign(awakening.itemArt!, { [aw('frame')]: ' .--------.\n |   ||   |\n \'--------\'', [aw('prism')]: '   /\\\n  /__\\\n /___/ ', [aw('viewer')]: ' .--------.\n |  /\\   |\n \'-/__\\--\'', [aw('source-card')]: '.-----------.\n| : | :: |  |\n|___|____|__|' });

// Inspection, not a permanent marker, reveals the maintenance hatch.
awakening.scenes.threshold.environment!.push(awEnv('departure-trace', 'Kopott kilépési nyom', 'A KILÉPÉSI SZEMLE felirat alatt kopott talpnyom fordul az alacsony mellékajtóhoz. A sávra utólag kisebb betűket véstek: „A NYITOTT AJTÓ NEM NYILATKOZAT”. Az ajtó a körfolyosótól különálló kiszolgálóágba vezet.'));
awakening.scenes.threshold.exits!.push({ ...awExit('wing-entry', 'Az alacsony mellékajtón át'), requires: { discoveries: [aw('departure-trace')] } });
awakening.scenes.threshold.artSpots!.push(
  { id: aw('spot:departure-trace'), environment: aw('departure-trace'), row: 19, col: 50, width: 25, height: 1, glyph: 'KILEPESI SZEMLE' },
  { id: aw('spot:wing-entry'), exit: aw('wing-entry'), row: 22, col: 8, width: 19, height: 3, glyph: '.----------------.\n| MELLEKAJTO ->  |\n\'----------------\'' },
);
const hallLook = awakening.scenes.threshold.rules.find(rule => rule.id === 'look:hall')!;
hallLook.discover = [...hallLook.discover ?? [], aw('departure-trace')];
hallLook.message += ' Az ablak alatti kopott sávon még egy helyi felirat válik olvashatóvá: „KILÉPÉSI SZEMLE / A NYITOTT AJTÓ NEM NYILATKOZAT”. Egy alacsony mellékajtóhoz vezet.';
awakening.scenes.threshold.rules.push(awMove('wing-entry', aw('cloakroom'), 'Az alacsony ajtó mögött az üres köpenyek nem lengenek. Az utolsó vállfa alatt friss, keskeny csík látszik a porban.', { discoveries: [aw('departure-trace')] }));
awakening.scenes.threshold.rules.at(-1)!.addFlags = [aw('wing-entered')];

awakening.scenes[aw('cloakroom')] = {
  title: 'I/a · A köpenyváltó', description: 'Az ébresztőszobákhoz tartozó köpenyváltóban három üres vállfa lóg. Alattuk kopott pad, a falon KILÉPÉSI SZEMLE felirat. Balra a víz kiegyenlítője csobban, jobbra rézsútos fény esik egy műhelyajtóra. Szemben zárt, puha redőny áll; az eredeti körfolyosóra vezető ajtó nyitva maradt.', requires: wingDoor,
  arrivalDiscoveries: ['coats', 'departure-board'].map(aw),
  environment: [awEnv('coats', 'Üres köpenyek és pad', 'A köpenyeket kifordítva hagyták a vállfákon. A pad deszkája alatt tisztább négyszög látszik.'), awEnv('departure-board', 'Kilépési szemle táblája', '„A NYITOTT AJTÓ NEM NYILATKOZAT.” Alatta: VÍZ — FÉNY — FORRÁS — DÖNTÉS. Egy régi mondatot csak áthúztak, nem kivéstek: „A hallgatás beleegyezés.” A szemle táblája az áthúzást őrzi, nem állítja, ki húzta át.'), awEnv('loose-frame', 'Pad alatti keret', 'Lapos, réses keret fekszik a pad alsó lécein. Háromszögű fészke üres; a rugós perem még ép.', awPhase([], ['frame-taken']))],
  exits: [awExit('wing-back', 'Vissza a körfolyosóra'), awExit('water', 'A kiegyenlítőbe'), awExit('light', 'A súrlófény-műhelybe'), awExit('sorting', 'A puha redőny mögé')],
  ...wingPicture('KOPENYVALTO / KILEPESI SZEMLE', [[3, 8, '--------+-----------+-----------+--------'], [4, 16, '|           |           |'], [21, 6, '____________________________________________________________']], [
    { name: 'coats', row: 6, col: 10, glyph: ' /\\       /\\       /\\\n/  \\     /  \\     /  \\\n|  |     |  |     |  |\n|__|     |__|     |__|', width: 30 },
    { name: 'departure-board', row: 5, col: 48, glyph: '.--------------------------.\n| VIZ  FENY  FORRAS  DONTES |\n|                          |\n| A NYITOTT AJTO            |\n| NEM NYILATKOZAT           |\n\'--------------------------\'' },
    { name: 'loose-frame', row: 16, col: 25, glyph: '.--------.\n|   ||   |\n\'--------\'', actions: ['look', 'take'] },
    { name: 'water', row: 12, col: 4, glyph: '| ~~~ |\n|  v  |\n|_____|', exit: true },
    { name: 'light', row: 12, col: 65, glyph: '| / / |\n|  >  |\n|_____|', exit: true },
    { name: 'sorting', row: 15, col: 47, glyph: '.------------.\n| ########## |\n| ########## |\n\'------------\'', exit: true },
    { name: 'wing-back', row: 25, col: 7, glyph: '[ << KORFOLYOSO ]', exit: true },
  ]),
  rules: [awLook('coats', 'Az üres köpenyek alatt a pad alsó lécein lapos nézőkeret fekszik. Közepén rés, a belső peremén háromszögű bevágás. A köpenyek címkéit üresen hagyták.', { discover: [aw('loose-frame')], messageVariants: [{ requires: awPhase(['frame-taken']), text: 'Az üres köpenyek alatt a pad lécei is üresek. A keretet már kiemelted innen; a porban megmaradt a tiszta négyszög.' }] }),
    { id: aw('take:frame'), kind: 'take', label: 'Felveszem', interaction: { verb: 'take', target: awTarget('loose-frame') }, requires: { discoveries: [aw('loose-frame')], ...awPhase([], ['frame-taken']) }, addItems: [aw('frame')], addFlags: [aw('frame-taken')], message: 'A réses keretet kihúzod a pad alól. A rugó megfeszül az ujjad alatt, aztán visszaáll.' },
    { id: aw('combine:viewer'), kind: 'combine', label: 'Kombinálás', portable: true, interaction: { verb: 'combine', item: aw('frame'), target: { kind: 'item', id: aw('prism') } }, requires: { items: [aw('frame'), aw('prism')] }, removeItems: [aw('frame'), aw('prism')], addItems: [aw('viewer')], addFlags: [aw('viewer-made')], message: 'A tejüveg hasáb a háromszögű fészekbe illik. Rácsukod a keret rugós peremét. A keskeny rés egyenesen vezeti a súrlófényt; a nézőke egy kézben tartható.' },
    awMove('wing-back', 'threshold', 'Visszalépsz a körfolyosóra. A 90-es ajtó mögött továbbra is az eredeti ébresztőszoba áll.'), awMove('water', aw('water-room'), 'A csobbanás két egymás melletti üveghengerből jön. A kifolyók nyitott gyűjtővályúba torkollnak.'), awMove('light', aw('light-room'), 'A műhelyben a fényt nem erősítik: egy keskeny sávba terelik.'), awMove('sorting', aw('source-room'), 'A vízmérleg retesze nyitva tartja a puha redőnyt. Mögötte lapos iktatóasztal vár.', flowOpen),
    { ...awMove('sorting', aw('source-room'), 'A redőny puha, mégsem tolható félre. A bal oldali ajtó felől víz mozdul; egy kis úszó a zár nyelvéhez kötött rudat tartja.', awPhase([], ['flow-latched'])), id: aw('move:sorting:closed'), moveTo: undefined },
  ],
};

const volumes = (large: number, small: number): Requirement => awPhase([...(large ? [`large-${large}`] : []), ...(small ? [`small-${small}`] : [])], [...[1, 2, 3].filter(n => n !== large).map(n => `large-${n}`), ...[1, 2].filter(n => n !== small).map(n => `small-${n}`)]);
const volumeFlags = ['large-1', 'large-2', 'large-3', 'small-1', 'small-2'].map(aw);
function vessels(large: number, small: number) {
  return [' HOSSZU       ROVID', ' .----.       .----.', ...[3, 2, 1].map(level => ` |${large >= level ? '~~~~' : '    '}| ${level}     ${level <= 2 ? `|${small >= level ? '~~~~' : '    '}| ${level}` : '      '}`), ' |____|       |____|'].join('\n');
}
awakening.scenes[aw('water-room')] = {
  title: 'I/b · A kiegyenlítő', description: 'Két számozott üveghenger áll a csempén. A hosszú három, a rövid két rovátkát visel. Csak a hosszút tölti fel a felső csap; a két forgatható csőr egymásba tudja átönteni a vizet. Mindkét henger alján külön ürítőkar van. A felesleg a nyitott vályúba folyik, nem a járdára. A redőny rúdját úszós mérleg fogja.', requires: wingDoor,
  arrivalDiscoveries: ['vessels', 'fill', 'empty-large', 'empty-small', 'pour-small', 'pour-large', 'float-test'].map(aw),
  environment: [awEnv('vessels', 'Rovátkás üveghengerek', 'A hosszú hengeren három, a röviden két egyenlő rovátka. Az átöntés addig tart, amíg a forráshenger kiürül vagy a másik megtelik. A csap mindig tele tölti a hosszút; nincs külön csap a rövid fölött.'), awEnv('fill', 'Felső töltőcsap', 'A felső csap a hosszú hengert a harmadik rovátkáig tölti. A túlfolyó nem engedi magasabbra a vizet.'), awEnv('empty-large', 'Hosszú henger ürítője', 'A hosszú henger alján széles kar. Lenyanására a víz a gyűjtővályúba fut.'), awEnv('empty-small', 'Rövid henger ürítője', 'A rövid henger alján keskeny kar. A kifolyó közvetlenül a gyűjtővályú fölött áll.'), awEnv('pour-small', 'A rövid felé forduló csőr', 'A csőr a hosszú hengerből a rövidbe vezet. A peremen kicsi nyíl követi a víz útját.'), awEnv('pour-large', 'A hosszú felé forduló csőr', 'A másik csőr a rövid hengerből a hosszúba fordul. A két henger közti víz így visszaönthető.'), awEnv('float-test', 'Úszós mérleg nyelve', 'A mérleg ábráján a hosszú henger második rovátkája mellett vízjel áll, a rövidet szárazon rajzolták. Alatta: „KÉT EGYSÉG TERHELÉS / ÜRES VISSZATÉRŐ”. A nyelv lenyomása csak leolvassa az úszókat; a víz nem változik tőle.'), awEnv('loose-prism', 'Úszóházban fekvő hasáb', 'A nyitott úszóház belső párkányán tejfehér, háromszögű optikai hasáb ül. Nem a zár része: a helyén csak egy elszíneződött, háromszögű folt maradna.', awPhase(['flow-latched'], ['prism-taken']))],
  exits: [awExit('water-back', 'Vissza a köpenyekhez')],
  ...wingPicture('KIEGYENLITO / NYITOTT GYUJTOVALYU', [[5, 8, '========+=========================='], [6, 16, '|'], [21, 5, '\\__________________________________________________________________/']], [
    { name: 'vessels', row: 9, col: 25, glyph: vessels(0, 0), width: 29, height: 6 },
    { name: 'fill', row: 3, col: 13, glyph: '  --+--\n    |\n    v', actions: ['look', 'use'] },
    { name: 'empty-large', row: 17, col: 25, glyph: ' [___] v', actions: ['look', 'use'] },
    { name: 'empty-small', row: 17, col: 42, glyph: ' [_] v', actions: ['look', 'use'] },
    { name: 'pour-small', row: 7, col: 26, glyph: ' ____>____', actions: ['look', 'use'] },
    { name: 'pour-large', row: 16, col: 26, glyph: ' ____<____', actions: ['look', 'use'] },
    { name: 'float-test', row: 8, col: 60, glyph: '.-----------.\n|  II / _   |\n|   o---|   |\n\'-----------\'', width: 13, height: 4, actions: ['look', 'use'] },
    { name: 'loose-prism', row: 16, col: 62, glyph: '  /\\\n /__\\', actions: ['look', 'take'] },
    { name: 'water-back', row: 26, col: 5, glyph: '[ << KOPENYEK ]', exit: true },
  ]), rules: [],
};
const water = awakening.scenes[aw('water-room')];
water.descriptionVariants = [];
const waterSpot = water.artSpots!.find(spot => spot.environment === aw('vessels'))!;
waterSpot.glyphVariants = [];
for (let large = 0; large <= 3; large++) for (let small = 0; small <= 2; small++) {
  const requires = volumes(large, small);
  waterSpot.glyphVariants.push({ requires, text: vessels(large, small) });
  water.descriptionVariants.push({ requires, text: `A hosszú üveghengerben ${large}, a rövidben ${small} egység víz áll. A hosszú három, a rövid két rovátkáig tölthető. A töltőcsap és a két csőr fölött nyilak, alul külön ürítők vezetnek a nyitott gyűjtővályúba. Az úszós mérleg a redőny rúdjához csatlakozik.` });
  water.rules.push(awLook('vessels', `A hosszú hengerben ${large}, a rövidben ${small} egység áll. A hosszú teljes térfogata három, a rövidé kettő. Átöntéskor az egyik kiürüléséig vagy a másik megteléséig folyik a víz.`, { id: aw(`look:vessels:${large}:${small}`), requires }));
  for (const [name, nextLarge, nextSmall] of [
    ['fill', 3, small], ['empty-large', 0, small], ['empty-small', large, 0],
    ['pour-small', large - Math.min(large, 2 - small), small + Math.min(large, 2 - small)],
    ['pour-large', large + Math.min(small, 3 - large), small - Math.min(small, 3 - large)],
  ] as const) water.rules.push(awUse(name, `${large}:${small}`, nextLarge === large && nextSmall === small ? 'A víz nem mozdul: a forrás már üres, a fogadó tele van, vagy a kívánt szintet már elérted.' : `A víz átcsobban a csempék között. A hosszú hengerben most ${nextLarge}, a rövidben ${nextSmall} egység áll.`, { requires, removeFlags: volumeFlags, addFlags: [...(nextLarge ? [aw(`large-${nextLarge}`)] : []), ...(nextSmall ? [aw(`small-${nextSmall}`)] : [])] }));
}
water.rules.push(
  awUse('float-test', 'latched', 'A redőny rúdját már külön retesz tartja. A vízszinteket tovább próbálgathatod; a nyitott átjárót nem zárják vissza.', { requires: flowOpen }),
  awUse('float-test', 'balanced', 'A hosszú henger két egysége kiegyensúlyozza a száraz visszatérőt. Az úszórúd megemeli a puha redőnyt; külön retesz ül alá. Az úszóház fedele is felbillen: egy tejfehér hasáb csillan benne.', { requires: { ...volumes(2, 0), withoutFlags: [...volumes(2, 0).withoutFlags!, aw('flow-latched')] }, addFlags: [aw('flow-latched')], discover: [aw('loose-prism')], notes: ['A hosszú henger két egysége és az üres rövid henger nyitotta a szemle redőnyét. A külön retesz nyitva tartja.'] }),
  awUse('float-test', 'unbalanced', 'A mérleg nyelve visszalendül. Az ábrán a hosszú henger második rovátkájánál van a vízjel, a rövid alatt száraz vonal; a mostani úszóállás ettől eltér.', { requires: awPhase([], ['flow-latched']) }),
  { id: aw('take:prism'), label: 'Felveszem', kind: 'take', interaction: { verb: 'take', target: awTarget('loose-prism') }, requires: { discoveries: [aw('loose-prism')], ...awPhase(['flow-latched'], ['prism-taken']) }, addItems: [aw('prism')], addFlags: [aw('prism-taken')], message: 'A tejüveg prizmát kiemeled a felbillent úszóházból. A redőnyt tartó rúd nem mozdul; a hasáb csak itt volt eltéve.' },
  awMove('water-back', aw('cloakroom'), 'A víz a hengerekben marad. A köpenyváltó küszöbén újra hallod a körfolyosó távoli hangjait.'),
);
water.artSpots!.find(spot => spot.environment === aw('float-test'))!.glyphVariants = [{ requires: flowOpen, text: '.-----------.\n|  II / _   |\n|   *---/   |\n\'-----------\'' }];
awakening.scenes[aw('cloakroom')].artSpots!.find(spot => spot.exit === aw('sorting'))!.glyphVariants = [{ requires: flowOpen, text: '.------------.\n| ========== |\n|            |\n\'------------\'' }];
awakening.scenes[aw('cloakroom')].descriptionVariants = [
  { requires: { ...flowOpen, flags: [...flowOpen.flags!, aw('frame-taken')] }, text: 'A köpenyek változatlanul üresek, a pad lécei alól már kivetted a keretet. A KILÉPÉSI SZEMLE táblája mellett a redőnyt külön retesz tartja nyitva. Balra a kiegyenlítő, jobbra a súrlófény-műhely, hátul a körfolyosó nyitott ajtaja.' },
  { requires: flowOpen, text: 'A köpenyek üresen lógnak a pad fölött. A KILÉPÉSI SZEMLE táblája mellett a redőnyt külön retesz tartja nyitva. Balra a kiegyenlítő, jobbra a súrlófény-műhely, hátul a körfolyosó nyitott ajtaja.' },
];

awakening.scenes[aw('light-room')] = {
  title: 'I/c · A súrlófény-műhely', description: 'A fekete munkapadon domború, fehér papír fekszik. Felül forgatható lámpa, előtte elforduló árnyékoló. A lap első pillantásra üres; a vonalai nem tintával készültek. A falon a rajzolt háromszögű hasáb mellett keskeny, réses keret körvonala. A szerszámos sín végén csipesz vár.', requires: wingDoor,
  arrivalDiscoveries: ['lamp', 'shutter', 'relief', 'optics-note'].map(aw),
  environment: [awEnv('lamp', 'Háromállású munkalámpa', 'A munkalámpa állásai: SZEMBŐL, FÖLÜLRŐL, OLDALRÓL. Minden fordítás a következő ütközőhöz viszi. A világítás nem időzített.'), awEnv('shutter', 'Forgó árnyékoló', 'A fekete lemez nyitott állásban elengedi a fényt, zárt állásban árnyékot vet a munkapadra. A tengelyre fényes félkört karcoltak.'), awEnv('relief', 'Fehér dombornyomat', 'A fehér papírba sekély vájatokat préseltek. Szemből a vonalak elvesznek a fényben. Nem a betűk hiányoznak: a mélységüket kell láthatóvá tenni.'), awEnv('optics-note', 'Fényút rajza', 'A rajzon a fény a lap mellől érkezik, és a sekély vájat belső falára hosszú árnyékot vet. A szaggatott háromszögű hasábot egy kéz tartja; mellette ugyanaz keretben, egyenesen. A felirat: „ANYAGI NYOM / NEM SZERZŐSÉGI IGAZOLÁS”.'), awEnv('loose-source-card', 'Sínvégi forráslap', 'A csipesz alatt keskeny lap szabadult fel. Három oszlopa: SZEMLE, KÖZLÉS, HIÁNY. A peremén lyukak illenek az iktatóasztal három tüskéjére.', awPhase(['relief-read'], ['card-taken']))],
  exits: [awExit('light-back', 'Vissza a köpenyekhez')],
  ...wingPicture('SURLOFENY-MUHELY / FEHER DOMBORNYOMAT', [[16, 8, '________________________________________________________________'], [17, 8, '|                                                              |'], [23, 12, '|                                                          |']], [
    { name: 'lamp', row: 4, col: 12, glyph: '   .---.\n  (  |  )\n   \'-+-\'\n     |', width: 12, height: 5, actions: ['look', 'use'] },
    { name: 'shutter', row: 8, col: 35, glyph: '  .----.\n  |####|\n  \'----\'', width: 10, height: 3, actions: ['look', 'use'] },
    { name: 'relief', row: 12, col: 20, glyph: '.----------------------------.\n|  .   . .    .    . .       |\n|    .    .  .   .           |\n\'----------------------------\'', width: 30, height: 4 },
    { name: 'optics-note', row: 4, col: 51, glyph: '  --> /\\  ______\n     /__\\ | : : |\n          |_____|\n ANYAGI NYOM', width: 20, height: 5 },
    { name: 'loose-source-card', row: 19, col: 53, glyph: '.--------------.\n| : | :: |     |\n\'--------------\'', actions: ['look', 'take'] },
    { name: 'light-back', row: 26, col: 5, glyph: '[ << KOPENYEK ]', exit: true },
  ]), rules: [],
};
const light = awakening.scenes[aw('light-room')];
const angles = ['SZEMBŐL', 'FÖLÜLRŐL', 'OLDALRÓL'];
const anglePhase = (angle: number) => awPhase(angle ? [`angle-${angle}`] : [], [1, 2].filter(n => n !== angle).map(n => `angle-${n}`));
for (let angle = 0; angle < 3; angle++) {
  const next = (angle + 1) % 3;
  light.rules.push(awUse('lamp', String(angle), `A lámpa a következő ütközőhöz fordul: ${angles[next]}.`, { requires: anglePhase(angle), removeFlags: [aw('angle-1'), aw('angle-2')], addFlags: next ? [aw(`angle-${next}`)] : [] }));
  light.rules.push(awLook('lamp', `A lámpa jelenlegi állása: ${angles[angle]}. A másik két ütköző is elérhető; egy fordítás a következő állásra vált.`, { id: aw(`look:lamp:${angle}`), requires: anglePhase(angle) }));
}
light.rules.push(awUse('shutter', 'open', 'Az árnyékolót elfordítod a fény útjából. A fekete lemez élére áll.', { requires: awPhase([], ['shutter-open']), addFlags: [aw('shutter-open')] }), awUse('shutter', 'close', 'A fekete árnyékoló visszafordul a lap elé.', { requires: awPhase(['shutter-open']), removeFlags: [aw('shutter-open')] }));
const reliefMilestone = { id: aw('source-visible'), title: 'A nyom nem vallomás', text: 'Oldalról vezettem fényt a fehér papírra. A sekély vájatok nem titkos üzenetté, hanem rendezett jelkulccsá álltak össze: szemle, közlés, hiány. A rajz külön figyelmeztetett, hogy az anyagi nyom nem igazolja a szerzőjét. Az új eszközzel a papír felszínét láttam jobban; a múltba nem nyílt ablak.' };
for (const item of ['prism', 'viewer']) {
  const pattern = { verb: 'use' as const, item: aw(item), target: awTarget('relief') };
  light.rules.push({ id: aw(`use:${item}:relief:repeat`), label: 'Használom', kind: 'use', interaction: pattern, requires: awPhase(['relief-read']), message: 'A korábban kiolvasott dombornyomat jelkulcsa megmaradt: SZEMLE — jelenben megfigyelhető; KÖZLÉS — valaki vagy egy felirat állítása; HIÁNY — nincs adat. A fény újrabeállítása nem vonja vissza a már elolvasott lapot.' });
  light.rules.push({ id: aw(`use:${item}:relief:read`), label: 'Használom', kind: 'use', interaction: pattern, requires: awPhase(['angle-2', 'shutter-open'], ['relief-read']), addFlags: [aw('relief-read')], discover: [aw('loose-source-card')], milestone: reliefMilestone, notes: ['A forrásjelkulcs három oszlopa: SZEMLE — megfigyelhető; KÖZLÉS — állítás; HIÁNY — nincs adat. Nem hitelesít szerzőséget.'], message: `A ${item === 'viewer' ? 'keretben tartott hasábon' : 'kézben tartott prizmán'} át a súrlófény hosszú árnyékot húz a vájatokba. SZEMLE — JELENBEN MEGFIGYELHETŐ. KÖZLÉS — VALAKI VAGY EGY FELIRAT ÁLLÍTÁSA. HIÁNY — NINCS ADAT. Alul: ANYAGI NYOM / NEM SZERZŐSÉGI IGAZOLÁS. A sínvégi csipesz felenged: a jelkulcs hordozható forráslapját tartotta.` });
  light.rules.push({ id: aw(`use:${item}:relief:dark`), label: 'Használom', kind: 'use', interaction: pattern, message: 'A hasábban csak szétszórt fehér fény látszik. A vájatoknak most nincs éles, oldalukról vetett árnyéka; a lámpa vagy az árnyékoló útját követve megvizsgálhatod, hol akad el a fény.' });
}
light.rules.push({ id: aw('take:source-card'), label: 'Felveszem', kind: 'take', interaction: { verb: 'take', target: awTarget('loose-source-card') }, requires: { discoveries: [aw('loose-source-card')], ...awPhase(['relief-read'], ['card-taken']) }, addItems: [aw('source-card')], addFlags: [aw('card-taken')], message: 'A háromoszlopos forráslapot kihúzod a csipeszből. A dombornyomat a helyén marad; a sín végén már csak az üres csipesz áll.' }, awMove('light-back', aw('cloakroom'), 'Kilépsz a műhelyből. A papír, a lámpa és az árnyékoló az általad hagyott állásban marad.'));
light.artSpots!.find(spot => spot.environment === aw('shutter'))!.glyphVariants = [{ requires: awPhase(['shutter-open']), text: '     |\n     |\n     |' }];
light.artSpots!.find(spot => spot.environment === aw('lamp'))!.glyphVariants = [
  { requires: anglePhase(1), text: '   .---.\n  (  v  )\n   \'-+-\'\n     |' }, { requires: anglePhase(2), text: '   .---.\n  ( --> )\n   \'-+-\'\n     |' },
];
light.artSpots!.find(spot => spot.environment === aw('relief'))!.glyphVariants = [{ requires: awPhase(['relief-read', 'angle-2', 'shutter-open']), text: '.----------------------------.\n| SZEMLE  KOZLES  HIANY      |\n|  : :      ::      _        |\n\'----------------------------\'' }];
light.environment!.find(entity => entity.id === aw('relief'))!.descriptionVariants = [{ requires: awPhase(['relief-read']), text: 'A már elolvasott jelkulcs a fehér papír vájataiban maradt: SZEMLE — jelenben megfigyelhető; KÖZLÉS — valaki vagy egy felirat állítása; HIÁNY — nincs adat. A megvilágítás pillanatnyi állása nem változtatja meg ezt a korábbi leolvasást.' }];

awakening.scenes[aw('source-room')] = {
  title: 'I/d · A források asztala', description: 'Az asztalon három egymástól független jelölőtárcsa ül. Az első mellett csuklószemle, a másodiknál a karantén feliratának másolata, a harmadiknál üres névmező. Középen három tüske vár egy forráslapra. A falon: „FORRÁST JELÖLJ, NE IGAZSÁGOT”. A további ajtó másolatfogó kapoccsal záródik.', requires: flowOpen,
  arrivalDiscoveries: ['card-bed', 'wrist-source', 'claim-source', 'name-source', 'source-check'].map(aw),
  environment: [awEnv('card-bed', 'Háromtüskés lapágy', 'A három tüske eltérő távolságra áll. A súrlófény-műhely csipeszében tartott forráslap lyuksora illik rájuk. A lapágy nem vizsgál aláírást vagy személyazonosságot.'), awEnv('wrist-source', 'Csuklószemle jelölője', 'Az első lapra a saját csuklódat fektetheted. A bőrödön most is kilenc apró heg látszik. A jelölő a forrás fajtáját választja, nem azt, ki és mikor ejtette a hegeket.'), awEnv('claim-source', 'Karanténfelirat jelölője', 'A második lap szélén forrásmegjelölés: „A 09-es ajtóról másolva”. Az idézet: „BELSŐ KARANTÉN / ÖNKÉNTES”. Ebből a felirat szövegét ismered, a múltbeli beleegyezés megtörténtét nem.'), awEnv('name-source', 'Üres névmező jelölője', 'A harmadik lapon a NÉV mező üres. Nem adtak hozzá nevet, aláírást vagy ellenőrizhető azonosítót. Az üres hely nem egy személy neve.'), awEnv('source-check', 'Másolatfogó ellenőrzőkar', 'Az ellenőrzőkar a három forrásjelölést együtt olvassa le. SZEMLE, KÖZLÉS, HIÁNY: a feladat nem egy vallomás elfogadása. A fal felirata szerint a forrást kell megjelölni, nem az állítás végső igazságát.')],
  exits: [awExit('source-back', 'Vissza a köpenyekhez'), awExit('decision', 'A kilépési fülkébe')],
  ...wingPicture('FORRASOK ASZTALA / NEM IGAZSAGVIZSGALAT', [[4, 9, 'FORRAST JELOLJ, NE IGAZSAGOT'], [16, 6, '___________________________________________________________________'], [17, 6, '|                                                                 |'], [23, 11, '|                                                        |']], [
    { name: 'wrist-source', row: 8, col: 8, glyph: ' CSUKLO\n .-----------.\n |   HIANY   |\n \'-----------\'', width: 15, actions: ['look', 'use'] },
    { name: 'claim-source', row: 8, col: 30, glyph: ' FELIRAT\n .-----------.\n |   HIANY   |\n \'-----------\'', width: 15, actions: ['look', 'use'] },
    { name: 'name-source', row: 8, col: 53, glyph: ' NEV: ______\n .-----------.\n |   HIANY   |\n \'-----------\'', width: 15, actions: ['look', 'use'] },
    { name: 'card-bed', row: 19, col: 22, glyph: '.----------------.\n| o     o    o   |\n\'----------------\'', width: 18, height: 3 },
    { name: 'source-check', row: 19, col: 53, glyph: ' .-------.\n | o--/  |\n \'-------\'', actions: ['look', 'use'] },
    { name: 'source-back', row: 26, col: 5, glyph: '[ << KOPENYEK ]', exit: true },
    { name: 'decision', row: 25, col: 54, glyph: '.----------------.\n| ====   [ ]     |\n\'----------------\'', exit: true },
  ]), rules: [],
};
const source = awakening.scenes[aw('source-room')];
source.rules.push({ id: aw('use:source-card'), kind: 'use', label: 'Használom', interaction: { verb: 'use', item: aw('source-card'), target: awTarget('card-bed') }, addFlags: [aw('card-registered')], message: 'A forráslapot a három tüskéhez illeszted, a jelölők fogaskerekei felveszik a három oszlop rendjét. A lapot visszateszed a zsebedbe; a beállítás megmarad.', messageVariants: [{ requires: awPhase(['card-registered']), text: 'A tüskék már átvették a forráslap oszloprendjét. A lapot visszateszed a zsebedbe; az asztal jelkulcsa nem változik.' }] });
const sourceNames = ['HIÁNY', 'SZEMLE', 'KÖZLÉS'];
const sourceGlyphs = ['HIANY', 'SZEMLE', 'KOZLES'];
const sourcePhase = (name: string, position: number) => awPhase(position ? [`${name}-${position}`] : [], [1, 2].filter(n => n !== position).map(n => `${name}-${n}`));
for (const [name, caption] of [['wrist-source', 'CSUKLO'], ['claim-source', 'FELIRAT'], ['name-source', 'NEV: ______']] as const) {
  const spot = source.artSpots!.find(spot => spot.environment === aw(name))!;
  spot.glyphVariants = [];
  for (let position = 0; position < 3; position++) {
    const next = (position + 1) % 3, state = sourcePhase(name, position);
    spot.glyphVariants.push({ requires: state, text: ` ${caption}\n .-----------.\n |  ${sourceGlyphs[position].padEnd(8)} |\n \'-----------\'` });
    source.rules.push(awUse(name, String(position), `A jelölő a következő forrásfajtára fordul: ${sourceNames[next]}.`, { requires: { ...state, flags: [...state.flags!, aw('card-registered')] }, removeFlags: [aw(`${name}-1`), aw(`${name}-2`)], addFlags: next ? [aw(`${name}-${next}`)] : [] }));
  }
  source.rules.push(awUse(name, 'no-card', 'A jelölő tengelye szabadon fordulna, de még nincs rajta oszloprend. A középső lapágy három tüskéje forráslapra vár.', { requires: awPhase([], ['card-registered']) }));
  source.environment!.find(entity => entity.id === aw(name))!.descriptionVariants = [0, 1, 2].map(position => ({ requires: sourcePhase(name, position), text: `${source.environment!.find(entity => entity.id === aw(name))!.description} A tárcsa jelenlegi állása: ${sourceNames[position]}.` }));
}
source.rules.push(
  awUse('source-check', 'repeat', 'A leadott másolat külön kapocsban maradt, az ajtót a saját retesze tartja. A jelölők további próbái már egy új, le nem adott tervezetet állítanak; a korábbi másolatot nem írják át.', { requires: awPhase(['sources-accepted']) }),
  awUse('source-check', 'accept', 'A csukló szemle, az ajtófelirat közlés, a hiányzó név adat nélküli mező marad. Az asztal a források elkülönítését fogadja el, nem a múlt magyarázatát. Egy másolat a kapocsba csúszik; a kilépési fülke ajtaja kinyílik.', { requires: awPhase(['card-registered', 'wrist-source-1', 'claim-source-2'], ['name-source-1', 'name-source-2', 'sources-accepted']), addFlags: [aw('sources-accepted')], milestone: { id: aw('sources-separated'), title: 'Amit láttam, amit állítottak', text: 'Három forrásfajtát jelöltem meg az asztalon. A kilenc heg a csuklómon megfigyelhető volt. Az önkéntes karantén az ajtó állítása maradt. A nevem helyén pedig továbbra sem volt adat. Lenyomtam az ellenőrzőkart; a másolat a kapocsba csúszott, és kinyílt a kilépési fülke ajtaja. Az asztal a jelöléseket fogadta el, nem a múlt magyarázatát.' } }),
  awUse('source-check', 'no-card', 'A kar nem fogja be a lapot: a középső három tüske még nem vette át a forráslap jelkulcsát.', { requires: awPhase([], ['card-registered']) }),
  awUse('source-check', 'mismatch', 'A másolat széle visszacsúszik. A hegek most megvizsgálhatók; az önkéntesség az ajtóról másolt állítás; a névmezőhöz nincs adat. A jelölés és a feltüntetett forrás nem minden oszlopban egyezik.', { requires: awPhase(['card-registered'], ['sources-accepted']) }),
  awMove('source-back', aw('cloakroom'), 'A köpenyek között nem változott meg a csönd. A redőny nyitva marad.'), awMove('decision', aw('decision-room'), 'Az utolsó fülkében nincs szék és nincs hangszóró. Két nyilatkozatkar és egy kimenő másolat ablaka vár.', reviewed),
  { ...awMove('decision', aw('decision-room'), 'A másolatfogó kapocs még az ajtót tartja. A forrásjelölések ellenőrzése nélkül nem emelkedik fel.', awPhase([], ['sources-accepted'])), id: aw('move:decision:closed'), moveTo: undefined },
);
source.artSpots!.find(spot => spot.environment === aw('card-bed'))!.glyphVariants = [{ requires: awPhase(['card-registered']), text: '.----------------.\n| : :   ::   _   |\n\'----------------\'' }];
source.artSpots!.find(spot => spot.exit === aw('decision'))!.glyphVariants = [{ requires: awPhase(['sources-accepted']), text: '.----------------.\n| /              |\n\'----------------\'' }];
source.descriptionVariants = [{ requires: awPhase(['sources-accepted']), text: 'Az asztal kapcsában a már leadott forrásmásolat áll. A kilépési fülke ajtaját külön retesz tartja nyitva; a három jelölő most egy új, le nem adott tervezetet állít. A csuklószemle, a karanténfelirat másolata és az üres névmező a helyén maradt. A falon: FORRÁST JELÖLJ, NE IGAZSÁGOT.' }];
source.descriptionVariants.push({ requires: awPhase(['card-registered'], ['sources-accepted']), text: 'Az asztal három jelölőtárcsája már átvette a forráslap oszloprendjét. A középső lapágyon a SZEMLE, KÖZLÉS és HIÁNY jelei látszanak; a forráslapot visszatetted a zsebedbe. A csuklószemle, a karanténfelirat másolata és az üres névmező előtt állíthatók a jelölők. A falon: FORRÁST JELÖLJ, NE IGAZSÁGOT. A kilépési fülke ajtaját még a másolatfogó kapocs zárja.' });
source.environment!.find(entity => entity.id === aw('card-bed'))!.descriptionVariants = [{ requires: awPhase(['card-registered']), text: 'A lapágy már átvette a forráslap oszloprendjét. A tüskék mellett a SZEMLE, KÖZLÉS és HIÁNY jelei látszanak: pontpár, kettőspont és vízszintes vonás. A forráslapot visszatetted a zsebedbe; a jelölők a megőrzött rend szerint állíthatók. A lapágy továbbra sem vizsgál aláírást vagy személyazonosságot.' }];

awakening.scenes[aw('decision-room')] = {
  title: 'I/e · A saját kilépés fülkéje', description: 'Az üres fülkében két nyilatkozatkar áll. TOVÁBBMEGYEK és FENNTARTÁSSAL: egyik sem kér nevet. A falon külön sor: „JELENLEGI DÖNTÉS / NEM MÚLTBELI HOZZÁJÁRULÁS”. A másolatablak üres. A források asztala felé és a körfolyosóra vezető ajtó is nyitva áll.', requires: reviewed,
  arrivalDiscoveries: ['departure-plain', 'departure-reserved', 'departure-copy'].map(aw),
  environment: [awEnv('departure-plain', 'Továbbhaladási nyilatkozatkar', 'A kar mellett: „TOVÁBBMEGYEK — JELENLEGI SAJÁT DÖNTÉS”. Lenyomása ezt a mostani lépést rögzíti. Nem állítja, hogy a korábbi bezárás önkéntes volt, és nem töröl emléket.'), awEnv('departure-reserved', 'Fenntartásos nyilatkozatkar', 'A másik kar felirata: „TOVÁBBMEGYEK, A KORÁBBI ÖNKÉNTESSÉGET NEM IGAZOLOM”. Ugyanoda vezet, de a másolat megőrzi ezt a fenntartást. A karok vizsgálata még nem nyilatkozat.'), awEnv('departure-copy', 'Kimenő másolat ablaka', 'A keskeny ablak mögött üres tartó áll. A felirat: „HELYI KILÉPÉSI BEJEGYZÉS”. Ez nem emléktörlési kérelem és nem az archívum teljes iratanyaga.')],
  exits: [awExit('decision-back', 'Vissza a források asztalához'), awExit('departure-return', 'Vissza a körfolyosóra')],
  ...wingPicture('SAJAT KILEPES / JELENLEGI DONTES', [[4, 7, 'NEM MULTBELI HOZZAJARULAS'], [19, 6, '________________________________________________________________']], [
    { name: 'departure-plain', row: 8, col: 9, glyph: ' TOVABBMEGYEK\n .------------.\n |     /      |\n |    o       |\n \'------------\'', width: 22, height: 5, actions: ['look', 'use'] },
    { name: 'departure-reserved', row: 8, col: 45, glyph: ' FENNTARTASSAL\n .------------.\n |     /      |\n |    o       |\n \'------------\'', width: 22, height: 5, actions: ['look', 'use'] },
    { name: 'departure-copy', row: 16, col: 28, glyph: '.--------------------.\n|                    |\n\'--------------------\'', width: 22, height: 3 },
    { name: 'decision-back', row: 25, col: 5, glyph: '[ << FORRASOK ]', exit: true },
    { name: 'departure-return', row: 25, col: 49, glyph: '[ KORFOLYOSO >> ]', exit: true },
  ]), rules: [awMove('decision-back', aw('source-room'), 'Visszalépsz az asztalhoz. A már leadott forrásmásolat a kapocsban marad.'), { ...awMove('departure-return', 'threshold', 'Újra a tizenkét ajtó körfolyosóján állsz. Az ébresztőszoba ajtaja nyitva, az archívum olvasója még kilépési bejegyzésre vár. A mellékágba bármikor visszatérhetsz.'), messageVariants: [{ requires: closed, text: 'Újra a tizenkét ajtó körfolyosóján állsz. Az ébresztőszoba ajtaja nyitva, az archívum útja járható. A mellékágba bármikor visszatérhetsz.' }] }],
};
const decision = awakening.scenes[aw('decision-room')];
for (const [name, choice, statement] of [['departure-plain', 'plain', 'TOVÁBBMEGYEK — JELENLEGI SAJÁT DÖNTÉS'], ['departure-reserved', 'reserved', 'TOVÁBBMEGYEK, A KORÁBBI ÖNKÉNTESSÉGET NEM IGAZOLOM']] as const) {
  decision.rules.push(awUse(name, 'record', `Lenyomod a kart. A másolatablakban megjelenik: „${statement}”. Alatta: „HELYI KILÉPÉSI BEJEGYZÉS RÖGZÍTVE”. Az ébredés helyi eljárása itt lezárult; a neved és a többi hang kérdése nem kapott választ. Most először nem csak nyitott ajtót hagysz magad után, hanem a saját jelen idejű döntésedet is.`, { requires: awPhase([], ['chapter-closed']), addFlags: [aw('chapter-closed'), aw(`departure-${choice}`)], milestone: { id: aw(`closure-${choice}`), title: 'Ébren maradni', text: `A kilépési fülkében nem kértek nevet. A saját kezemmel nyomtam le a kart: „${statement}”. Ez a mostani döntésem volt, nem vallomás arról, amit nem tudtam felidézni. Az ébredés helyi eljárása véget ért; a történetem nem. A nyitott ajtó mögött ott maradt a hideg padló, előttem pedig a körfolyosó és az archívum. A nevemet továbbra sem tudtam. Most már ébren akartam utánajárni.` } }));
  decision.rules.push(awUse(name, 'repeat', 'A kimenő másolat már a korábbi döntésedet őrzi. A kar visszaenged, új bejegyzés nem készül. A mostani kilépés rögzítését nem írja át egy ismételt próbálkozás.', { requires: closed }));
}
decision.artSpots!.find(spot => spot.environment === aw('departure-copy'))!.glyphVariants = [
  { requires: awPhase(['departure-reserved']), text: '.--------------------.\n|FENNTARTAS ROGZITVE |\n\'--------------------\'' },
  { requires: awPhase(['departure-plain']), text: '.--------------------.\n| KILEPES ROGZITVE   |\n\'--------------------\'' },
];
decision.environment!.find(entity => entity.id === aw('departure-copy'))!.descriptionVariants = [
  { requires: awPhase(['departure-reserved']), text: 'A másolatablakban a saját mostani döntésed áll: „TOVÁBBMEGYEK, A KORÁBBI ÖNKÉNTESSÉGET NEM IGAZOLOM”. A helyi kilépési bejegyzés rögzítve; a korábbi iratok nem változtak meg.' },
  { requires: awPhase(['departure-plain']), text: 'A másolatablakban a saját mostani döntésed áll: „TOVÁBBMEGYEK — JELENLEGI SAJÁT DÖNTÉS”. A helyi kilépési bejegyzés rögzítve; a korábbi iratok nem változtak meg.' },
];
decision.descriptionVariants = [{ requires: closed, text: 'A két nyilatkozatkar visszaengedett alaphelyzetbe. A másolatablakban már rögzített helyi kilépési bejegyzés áll, a korábbi döntésed nem íródik át. A fal felirata továbbra is: JELENLEGI DÖNTÉS / NEM MÚLTBELI HOZZÁJÁRULÁS. Mindkét visszaút nyitva maradt.' }];
