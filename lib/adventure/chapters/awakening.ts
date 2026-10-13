import type { Chapter } from '../types.ts';

export const INTRO = 'Hideg padlón ébredsz. A szoba üresnek tűnik: egy fekvőlap, egy ajtó és egy néma falpanel. Nincs ablak. Nincs emlék. A falon halvány felirat: ÉV 7314 / ÉBRESZTÉS 09. A csuklódon kilenc apró heg. Valahonnan a saját hangodat hallod: „Ha újra felébredsz, ne mondd meg nekik a neved.”';
export const OPENING_ENTRY = { id: 'awakening:wake', chapter: 'I. Az ébredés', title: 'A kilencedik ébredés', text: 'A hideg volt az első emlékem. Nem egy arc, nem egy név: a padló hidege az arcom alatt. Amikor kinyitottam a szememet, az üres szoba falán a 7314-es évszám derengett. A csuklómon kilenc heg sorakozott. Aztán meghallottam a saját hangomat, bár a szám nem mozdult. Arra kért, ne mondjam meg nekik a nevemet. Egyelőre nem is tudtam volna.', turn: 0 };
const description = 'A hideg fényben egy fekvőlap, egy zárt ajtó és egy falpanel rajzolódik ki. A mennyezeten egy apró hangszóró figyel.';
export const awakening: Chapter = {
  id: 'awakening', title: 'I. Az ébredés',
  items: { foil: 'Vezető fólia', wire: 'Szigetelt huzal', bridge: 'Áthidaló hurok' },
  scenes: {
    chamber: { title: '01 · Az üres szoba', description, art: `        __________________________________
       /                                 /|
      /_________________________________/ |
      |                    __________   | |
      |   [ o ]           |          |  | |
      |   HANG            |    09    |  | |
      |                   |    []    |  | |
      |   __________      |          |  | /
      |  /_________/|     |__________|  |/
      |  |_________|/          [::]     /
      |________________________________/
                  EBRESZTES / 7314`, rules: [
      { id: 'look:room', label: 'Körülnézek', kind: 'look', message: description + ' A fekvőlap pereme felpúposodott. A panel két üres érintkezője között nem világít a jelzőfény.' },
      { id: 'look:bed', label: 'Megvizsgálom a fekvőlapot', kind: 'look', addFlags: ['bed-seen'], message: 'A fekvőlap nem ágy, hanem vizsgálóasztal. A perem alatti mélyedésben fólia helye látszik. A karcolás: „A zár nem kulcsot kér. Visszhangot.”', notes: ['A fekvőlapba karcolva: „A zár nem kulcsot kér. Visszhangot.”'] },
      { id: 'look:panel', label: 'Megvizsgálom a falpanelt', kind: 'look', addFlags: ['panel-seen'], message: 'A panel nem billentyűzet. Két érintkező: VISSZA és HANG. Köztük hiányzik az összeköttetés. A burkolat résében egy huzalnak kialakított vájat látszik. A figyelmeztetés: „Csak hajlékony, bevont hurokkal zárható. Puszta fémre az érzékelő nem reagál.”', notes: ['A panel két érintkezőjét hajlékony, bevont hurokkal kell összekötni.'] },
      { id: 'look:door', label: 'Megvizsgálom az ajtót', kind: 'look', message: 'Az ajtón nincs kilincs. A paneltől egy kábel vezet a zárhoz. A szám alatt pici betűk: „BELSŐ KARANTÉN / ÖNKÉNTES”. Önkéntes?', notes: ['A szoba ajtaján: „Belső karantén / önkéntes”.'] },
      { id: 'take:foil', label: 'Felveszem a fóliát', kind: 'take', requires: { flags: ['bed-seen'], withoutItems: ['foil', 'bridge'] }, addItems: ['foil'], message: 'A fekvőlap pereme alól kihúzod a vezető fóliát. A tenyeredben melegszik, mintha felismerne.' },
      { id: 'take:wire', label: 'Felveszem a huzalt', kind: 'take', requires: { flags: ['panel-seen'], withoutItems: ['wire', 'bridge'] }, addItems: ['wire'], message: 'A falpanel nyitott vájatából kiemelsz egy rövid huzalt. A szigetelése ép, de a végein nincs érintkezőfelület.' },
      { id: 'talk:voice', label: 'Megszólítom a hangot', kind: 'talk', addFlags: ['voice-heard'], message: '„Ébren vagy” – mondja a hang. „Én ŐR–0 vagyok. Nem emlékezhetek rád. Ezt te kérted.” Rövid csend. „A kilencedik alkalommal már nem mondhatom, hogy örülök.”', notes: ['ŐR–0 szerint én kértem, hogy ne emlékezzen rám. Ez a kilencedik alkalom.'], milestone: { id: 'awakening:guardian', title: 'A felejtés őre', text: 'A mennyezet hangszórója ŐR–0 néven mutatkozott be. Azt állította, hogy én kértem tőle a felejtést. Nem csak én veszítettem el az emlékeimet: valaki gondosan eltüntette a nyomomat a saját őröm fejéből is. És ez a valaki talán én voltam.' } },
      { id: 'talk:identity', label: 'Megkérdezem, ki vagyok', kind: 'talk', requires: { flags: ['voice-heard'] }, addFlags: ['identity-heard'], message: '„A nyilvántartás szerint te vagy az archivista. A nyilvántartást szerinted meghamisították.” A hang suttogásra vált. „A nevedet nem őrzöm. De a törlési kérelmeden a holnapi dátum szerepel.”', notes: ['Archivistának neveznek. Az emléktörlésemet holnapra kértem – mégis már megtörtént.'], milestone: { id: 'awakening:identity', title: 'A holnapi kérelem', text: 'Archivista. Ez volt az első szó, amellyel magamat azonosíthattam, és azonnal kétségbe is kellett vonnom. ŐR–0 szerint a nyilvántartás hamis lehetett. Ennél is rosszabb volt, amit az emléktörlésemről mondott: a kérelmet holnapra dátumoztam. Valaki előbb teljesítette, mint hogy megírhattam volna.' } },
      { id: 'talk:help', label: 'Az ajtóról kérdezem', kind: 'talk', requires: { flags: ['voice-heard'] }, message: '„Nem tilthatom meg, hogy kimenj. Azt sem, hogy visszatérj. Kösd össze a VISSZA és HANG érintkezőket. A huzal vezeti a jelet, a fólia ad neki felületet. Külön egyik sem elég.”' },
      { id: 'attack:voice', label: 'Megütöm a hangszóró burkolatát', kind: 'attack', message: 'A burkolat tompán kong. A kezedet puha erőtér fogja meg, mielőtt megsérülne. „Az indulatot feljegyeztem. Büntetés nincs” – mondja ŐR–0. „Ezt a szabályt is te írtad.” Minden működőképes marad.', notes: ['A védelmi rendszer nem büntet. ŐR–0 szerint én írtam ezt a szabályt.'] },
      { id: 'combine:foil:wire', label: 'Fólia + huzal → áthidaló hurok', kind: 'combine', requires: { items: ['foil', 'wire'] }, removeItems: ['foil', 'wire'], addItems: ['bridge'], message: 'A fóliát a huzal két végére hajtod. Rugalmas, bevont áthidaló hurok lesz belőle. A mozdulat túlságosan ismerős. Valaha már csináltad ezt.', milestone: { id: 'awakening:craft', title: 'A kezem emlékezett', text: 'Fóliát hajtottam a huzal két végére, majd hurokká görbítettem. Az ujjaim tudták, mit kell tenniük, mielőtt végiggondolhattam volna. Nem tért vissza egyetlen emlékkép sem, mégis bizonyos voltam benne: a testem már ismerte ezt a feladatot.' } },
      ...['foil', 'wire', 'bridge'].flatMap(item => [
        { id: `use:${item}:door`, label: `${{ foil: 'Vezető fólia', wire: 'Szigetelt huzal', bridge: 'Áthidaló hurok' }[item]} → ajtó`, kind: 'use' as const, requires: { items: [item] }, message: 'Az ajtón nincs ehhez illő nyílás. A zárat a falpanel vezérli. A tárgy nálad marad.' },
        ...(item === 'bridge' ? [] : [{ id: `use:${item}:panel`, label: `${item === 'foil' ? 'Vezető fólia' : 'Szigetelt huzal'} → falpanel`, kind: 'use' as const, requires: { items: [item] }, message: 'A tárgy önmagában nem köti össze megfelelően az érintkezőket. Talán kombinálni kellene valamivel. Nem fogyott el és nem sérült meg.' }]),
      ]),
      { id: 'use:bridge:panel', label: 'Áthidaló hurok → falpanel', kind: 'use', requires: { items: ['bridge'] }, addFlags: ['door-open'], message: 'A hurkot az érintkezőkhöz illeszted. A panel felvillan: „HANGMINTA ELFOGADVA”. Pedig nem szóltál. Az ajtó kinyílik. ŐR–0: „Nyolcszor belülről zártad be. Ez az első, hogy kifelé indulsz.” A hurkot visszateszed a zsebedbe.', notes: ['A hurok a hangmintámat hordozta. Az ajtót korábban nyolcszor én zártam be.'], milestone: { id: 'awakening:door', title: 'A zár visszhangja', text: 'A panel elfogadta a hangmintámat, pedig nem beszéltem. A hurok hordozott valamit belőlem, amit én nem ismertem fel. Amikor az ajtó elmozdult, ŐR–0 azt mondta: nyolcszor én zártam be, belülről. A kilencedik ébredéskor először próbáltam kifelé indulni. Nem tudtam, mitől védett eddig ez a szoba.' } },
      { id: 'move:blocked', label: 'Megpróbálok kimenni', kind: 'move', requires: { withoutFlags: ['door-open'] }, message: 'Az ajtó zárva marad. A megoldás valahol a szobában van. Nézd meg a tárgyakat és a falpanelt; ŐR–0 is adhat támpontot.' },
      { id: 'move:threshold', label: 'Kilépek a folyosóra', kind: 'move', requires: { flags: ['door-open'] }, moveTo: 'threshold', message: 'Kilépsz. Tizenkét ajtó, tizenkét azonos szoba. Mindegyikben a te hangod beszél, egy másodperc eltéréssel. A kijelzőn: „EGYETLEN SZEMÉLYZETI TAG AKTÍV.” Itt tart most a történet; a folytatás még készül. Az eddigi haladásod megmarad.', notes: ['Tizenkét szobából a saját hangom hallatszik. A rendszer mégis egyetlen személyt lát.'], milestone: { id: 'awakening:threshold', title: 'Tizenkét hang, egyetlen ember', text: 'Kiléptem a körfolyosóra. Tizenkét szobából hallottam a saját hangomat, mindegyikből egy másodperc késéssel. A rendszer egyetlen aktív személyzeti tagról tudott. Visszanéztem az ajtómra: kívülről 90-es számot viselt, nem 09-est. A válaszok helyett egy nagyobb rejtélybe jutottam. A folyosó végén valami lassan mozdult az üveg mögött.' } },
    ] },
    threshold: { title: '02 · A küszöb', description: 'A nyitott ajtón túl egy körfolyosó vár. Innen újabb fejezetek nyílhatnak; a szobába bármikor visszatérhetsz.', requires: { flags: ['door-open'] }, art: `       ___________________________________
      |      |      |      |      |      |
      |  07  |  08  |  09  |  10  |  11  |
      |______|______|  /   |______|______|
      |                /                |
      |         .-----/-----.           |
      |         | ARCHIVUM  |           |
      |         '-----------'           |
      |_________________________________|
                  NEM VAGY EGYEDUL`, rules: [
      { id: 'look:hall', label: 'Megnézem a folyosót', kind: 'look', message: 'Az üvegen túl nem csillagok látszanak, hanem lassan mozgó betűk. Egy mondat újra és újra összeáll: „AZ ARCHÍVUM NEM A MÚLTAT ŐRZI.” A további folyosók egy készülő fejezetben nyílnak meg.', notes: ['Az archívum nem a múltat őrzi.'] },
      { id: 'move:chamber', label: 'Visszamegyek a szobába', kind: 'move', moveTo: 'chamber', message: 'Visszatérsz a szobába. Az ajtó nyitva marad, ŐR–0 vár. Semmit nem veszítettél el.' },
    ] },
  },
};
