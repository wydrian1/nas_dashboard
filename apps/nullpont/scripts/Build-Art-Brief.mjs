import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG } from '../lib/game/catalog.ts';

// Public observations and visual poses only: no rules, predicates or private data.
const appRoot = fileURLToPath(new URL('..', import.meta.url));
const assets = JSON.parse(readFileSync(resolve(appRoot, 'lib/game/presentation/art/scenes.json'), 'utf8'));
const bindings = JSON.parse(readFileSync(resolve(appRoot, 'lib/game/presentation/bindings.json'), 'utf8'));
const phase = process.argv[2];
if (!['archive-relay', 'awakening', 'gallery', 'inventory', 'source'].includes(phase)) throw new Error('Expected archive-relay, awakening, gallery, inventory or source');
const selected = id => phase === 'inventory' ? false : phase === 'source' ? id === 'awakening:source-room' : phase === 'gallery' ? id === 'relay:gallery' : phase === 'archive-relay' ? /^(archive:|relay:|connection:)/.test(id) : /^(threshold|awakening:)/.test(id) && !['awakening:bed-detail', 'awakening:bed-rim', 'awakening:panel-detail'].includes(id);
const scenes = {};
const designNotes = {
  threshold: 'Körfolyosó tizenkét ajtóval összesen; a saját 90-es nyitott ajtó és tizenegy másik. Az új h05 a többi ajtó felfedezésére vezet. Az archívumi átjáró külön kapcsolódó assetje a 21. sor 29. oszlopától 18×3 karakter: ezt a helyet hagyd szabadon; a h01–h05 egyike se fedje. A visszaút a saját ajtón át, az öltöző mellékajtaja és az ablak külön elem. Ne rajzolj tizenkét üres puzzle-szobát.',
  'awakening:corridor-doors': 'Részletes folyosói körkép, tizenegy külön célozható zárt ajtóval, a brief sorrendjének megfelelő térbeli helyeken. Ne legyen ajtókártyák rácsa: falívek, padló, lámpák és perspektíva fogja össze. A saját nyitott 90-es nem új handler, a tizenkettedik ajtó. Csak a bal középső ajtó száma 80, a jobb középsőé 70; a többi számtábla kopott, nem olvasható. Nincs bizonyított lakó, arc vagy alak az ajtók mögött.',
  'awakening:cloakroom': 'A gépház előtere munkaköpenyekkel, szerelőpaddal, javítófelülettel és csövekkel. A vízkör vezérlése, iratvizsgáló műhely, iratpult és visszaút felismerhető; az iratpult felé acél tolóajtó. A felvehető keret ne maradjon a háttérben felvétel után.',
  'awakening:water-room': 'Vízkeringetést kiszolgáló gépterem: látható befolyó, lefolyó, két mérőhenger térfogatbeosztással, úszók, rudazat és hornyok. A működtetőkar ellenőrzi a mechanikus illeszkedést, önálló retesz tartja nyitva a tolóajtót. Nem nyomásmérő vagy mágikus számbillentyűzet. Az összes kért vízszint- és reteszpóz kell.',
  'awakening:light-room': 'Iratvizsgáló műhely valódi munkapaddal. Nagy dombornyomat és mellette kivehető kisebb oszlopos forráslap csipesszel; lámpa, forgó árnyékoló, optikai útvonalrajz. A h03 alap- és p01 képein a csipesz ZÁRT; p02 és p03 képein a kis forráslap helye ÜRES, a csipesz NYITOTT. p01/p03 oldalvilágításban olvasható vájatokat, alap/p02 nem kiemelt vájatokat ábrázol. A nagy dombornyomat minden állapotban marad. A h05 csak a felvehető kisebb lap képe; a nyitott csipesz h03-ban marad. A képes fényútmutató mind prizma, mind fényes fólia megoldást mutasson, ne egyetlen kötelező receptet.',
  'awakening:source-room': 'Iratkezelő pult, ahol a saját feljegyzés oszlopai illeszthetők. A h01 a csuklón ténylegesen látható KILENC HEG megfigyelését jelöli: jóváhagyott papírfelirat „A csuklomon kilenc heg latszik.”, nem az ajtófelirat létezése. A régi megfigyelés jelentése nem változhat. A h02 a korábbi önkéntességre vonatkozó állítást, a h03 az ismeretlen nevet jelöli. A kategóriák SZEMLE, KOZLES, HIANY változatai maradjanak pontosak, de ne három külön kártya lebegjen a térben: munkaasztal, mozgatókapcsolók és továbbítósín kapcsolja össze őket. A lapillesztés tényleges vezetősíneket igazít, nem igazságvizsgáló gép.',
  'awakening:decision-room': 'Kijelentkezési pult az archívumi hozzáférés visszajelzőjével. Két egyenértékű választókar és ablak a megőrzött példánynak; egyik kar ne tűnjön jó/rossz választásnak. Pózokban a lap és a döntés különbsége legyen látható. Nincs történetvége vagy általános szabadulásábrázolás.',
};
for (const [id, art] of Object.entries(assets.scenes)) {
  if (!selected(id)) continue;
  const scene = CATALOG.scenes[id];
  scenes[id] = {
    title: scene?.title ?? 'Archívum bejárata a körfolyosón',
    description: scene?.description ?? 'Az archívumhoz vezető oldalsó átjáró. Kiegészítő rajz a körfolyosó terében; az átjáró maradjon elkülönülve a többi elemtől.',
    composition: 'Összefüggő, részletes tér vagy tárgyközelnézet; ne keretezett kártyák rácsa. Dekoráció, anyag, mélység; csak a megadott elemek és feliratok.',
    designNotes: designNotes[id] ?? '',
    budget: { columns: 100, rows: 50 },
    handlers: art.handlers.map(handler => {
      const binding = bindings.scenes[id].find(value => value.handler === handler.id);
      const entity = scene?.environment?.find(value => value.id === binding.environment);
      const exit = scene?.exits?.find(value => value.id === binding.exit);
      return {
        id: handler.id,
        label: entity?.label ?? exit?.label ?? 'Oldalsó átjáró az archívumhoz',
        observation: entity?.description ?? exit?.label ?? 'Átjáró',
        visualObservations: entity?.descriptionVariants?.map(value => value.text) ?? [],
        existingGlyph: handler.glyph ?? '',
        requiredPoses: handler.poses ?? {},
      };
    }),
  };
}
const items = Object.fromEntries(Object.entries(assets.items).filter(([id]) => phase === 'inventory' ? !['foil', 'wire', 'bridge'].includes(id) : phase === 'archive-relay' ? /^(archive:|relay:)/.test(id) : phase === 'awakening' && id.startsWith('awakening:')).map(([id, asset]) => [id, { label: CATALOG.items[id], description: CATALOG.itemDescriptions[id], budget: { columns: 18, rows: 9 }, existingGlyph: asset.glyph }]));
const output = resolve(appRoot, '../../.runtime/nullpont-ascii-brief.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ version: 1, phase, preserve: ['chamber', 'awakening:bed-detail', 'awakening:bed-rim', 'awakening:panel-detail', 'foil', 'wire', 'bridge'], instructions: 'Csak a scenes és items alatt felsorolt asseteket rajzold újra. A többit bájtra azonosan őrizd meg. A semleges handler- és pose-kulcsok nem változhatnak. A requiredPoses korábbi rajzai megmutatják az állapot jelentését; új, részletes rajz készül mindegyikhez. Új jelentős feliratot ne adj hozzá. Az eltűnő tárgy kizárólag dinamikus glyph, soha statikus háttér.', scenes, items }, null, 2) + '\n');
console.log(JSON.stringify({ phase, scenes: Object.keys(scenes).length, items: Object.keys(items).length, output }));
