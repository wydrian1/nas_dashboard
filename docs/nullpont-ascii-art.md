# NULLPONT ASCII-jelenetek tervezése

## Kötelező szereposztás

### Rajzi szerződés (1. verzió)

Állomány: `apps/nullpont/lib/game/presentation/art/scenes.json`.

```json
{
  "version": 1,
  "scenes": {
    "scene-id": {
      "background": "ASCII hatter",
      "handlers": [{
        "id": "h01", "row": 0, "col": 0, "width": 12, "height": 2,
        "glyph": "[ zarva ]",
        "poses": { "p01": "[ nyitva ]" }
      }]
    }
  },
  "items": { "item-id": { "glyph": "ASCII targykep" } }
}
```

A `row` és `col` nullától indul; a szélesség és magasság karaktercellákban értendő.
A háttér maximális sorhossza adja a vászon szélességét, sorainak száma a magasságát.
A `glyph` a handler alapképe, a `poses` az elnevezett további képek gyűjteménye.
Egyik változat sem léphet ki a handler téglalapjából. A semleges kulcsokat a brief
előre rögzíti: ne nevezd át őket. Az üres rajzi változat is állapot, ne töröld.
A betöltő legfeljebb 160×80 karaktert fogad el; a brief ennél kisebb keretet kérhet.
Az inventory tárgyképei legfeljebb **18×9** karakteresek lehetnek, hogy normál
betűmérettel a keskeny oldalsávba is beférjenek; üres tárgyképet nem fogadunk el.
Csak nyomtatható ASCII és LF sortörés megengedett. Ismeretlen mező hibát okoz.

A külön `presentation/bindings.json` nem rajzolói bemenet: ezt a kódoló kezeli.
Ott találkoznak a handlerek a környezeti/kijárati célpontokkal, a műveletekkel és
az állapotfeltételekkel. A `presentation/index.ts` betöltő hiányzó, felesleges,
dupla vagy rosszul kötött handlert/pózt nem fogad el. A fejezetkód a
`bindScene(sceneId)` eredményét használja; nem tartalmaz koordinátákat vagy rajzot.

A főagent a nyilvános, már megtervezett jelenetekből készíthet brief-vázlatot:
`node apps/nullpont/scripts/Build-Art-Brief.mjs archive-relay` vagy `awakening`.
Ez csak az ignorált briefet írja; megjelenési instrukciót és megfigyelhető prózát
ad át, játékállapot-feltételt vagy végrehajtható szabályt nem. A briefet át kell
nézni a delegálás előtt. Az első szoba és közelnézetei mindkét fázisból kimaradnak.

A rajzoló rögzített, csak olvasó ellenőrzése:
`D:/!nas/.runtime/node-v24.21.0-win-x64/node.exe apps/nullpont/scripts/Check-Art.mjs`.
A szerződés ellenőrzése nem helyettesíti a teljes rajz vizuális értékelését.
Ha a fájlolvasó egy hosszú JSON-háttérsort levág, a rajzoló használhatja a kötött,
csak olvasó `Read-Art.mjs <jelenetazonosító>` parancsot ugyanazzal a Node-útvonallal.
Minden engedélyezett teljes parancs külön, wildcard nélkül szerepel a profilban;
shell-láncolás, átirányítás és behelyettesítés nincs engedélyezve.
Ez kizárólag az előre engedélyezett nyilvános rajzokat adja vissza; nem fogad el
fájlútvonalat, kódot vagy további argumentumot, és nem olvas működési kötéseket.
A főagent az `Export-Art-Review.mjs` segéddel létrehozhatja az ignorált
`.runtime/nullpont-ascii-review.md` leltárt is: a pontos forráslenyomat mellett
minden háttér, handler és póz rövid sorokban olvasható. Ez nem jóváhagyás, és nem
helyettesíti a kötési feltételek és a tényleges böngészős megjelenés vizsgálatát.

A jelenet működése és a megjelenése külön szerkeszthető. A játékot tervező agent
nem rajzol tárgykártyákból összeállított helyettesítő képet: előbb megtervezi a
helyszín feladatát, szövegét, elemeit, tárgyait és rejtvényeit, utána az önálló
**`nullpont-ascii-artist`** agent készíti el a hozzájuk illő környezetrajzot.

Munkamenet:

1. **Tervező:** jóváhagyott vizuális brief a
   `.runtime/nullpont-ascii-brief.json` fájlban. Minden jelenetnél leírja a teret,
   funkcióját, anyagait, hangulatát, a szükséges elemeket és feliratokat. Megadja a
   stabil, semleges handlerneveket, a méretkeretet és minden szükséges képi
   állapotot. Nem ad át játékszabályt vagy privát storyboardot.
2. **Rajzoló:** csak a `lib/game/presentation/art/` JSON-állományait szerkeszti.
   Összefüggő teret rajzol építészeti részletekkel, berendezéssel, díszítéssel,
   kopással és olvasható tárgyakkal. A handlerek elnevezett képi területek,
   **nem végrehajtható függvények**, és nem tartalmaznak műveletet vagy feltételt.
3. **Kódoló:** külön kötési állományban rendeli a handlerekhez a környezeti
   elemeket, kijáratokat és műveleteket. A mentett állapot alapján a szerver
   választja ki a kért képi változatot. A rajzolónak nem kell ismernie a flagneveket
   vagy a rejtvény helyes lépéssorát.
4. **Ellenőrzés:** strukturális validálás, próza–rajz egyezés, asztali/mobil
   böngészős vizsgálat, majd a teljes összekötött jelenet független történeti
   jóváhagyása. Új vagy módosított rajz is érvényteleníti a korábbi jóváhagyást.

Eltűnő vagy változó tárgy nem rajzolható bele a statikus háttérbe. Külön rétegen
szerepeljen, hogy felvétel, kombinálás, ajtónyitás, visszatérés és újratöltés után
ne maradjon ott a régi rajza. A kattintási téglalapok ne fedjék egymást, és ne
nyúljanak a szomszédos tárgy vagy kijárat fölé. Az ismeretlen elemek mellett nincs
állandó „…” gomb, pótló jelölés vagy feladványmegoldást eláruló felirat.

A játék kézzel ellenőrzött, monospaced ASCII-rajzot és külön célpont-koordinátákat
használ. Képkonvertálás vagy generatív modell nem tudja megbízhatóan garantálni,
hogy a játék összes interaktív eleme felismerhető és jó helyen kattintható lesz.

## Korábban megvizsgált konverterek — nem a jelenetrajzolás munkafolyamata

A feladat közvetlenül **helyszínleírás → ASCII-jelenet**, nem egy meglévő kép
karakterekké alakítása. Az alábbi konvertereket ezért nem használjuk a jelenetek
elkészítésére; a felsorolás csak a korábbi technikai vizsgálatot dokumentálja.

- [Chafa](https://github.com/hpjansson/chafa): kép → karakterrajz, LGPL-3.0-or-later.
  A `--symbols ascii --format symbols --colors none --size 80x28` beállítás jó
  kiindulópont az egyszerű, kontrasztos vázlatokhoz. A kimenetet kézzel tisztítsd,
  különösen ajtóknál és apró tárgyaknál. Nem ad interaktív célpontokat.
- [chafa-wasm](https://github.com/hectorm/chafa-wasm): Chafa WebAssembly-változat;
  szerkesztői prototípushoz használható. Integrálás előtt a wrapper és az alapkönyvtár
  licencét is ellenőrizni kell. Nem része a játékcsomagnak.
- [FLUX.1-schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell):
  Apache-2.0 képgeneráló modell, helyben futtatható; nem közvetlen ASCII-generátor.
  A jelenetkép → Chafa útvonalat nem alkalmazzuk: nem közvetlen ASCII-rajzolás.
  A NAS Intel HD Graphics 630 grafikája miatt ezt most nem telepítjük: a nagy modell
  megfelelő GPU/memória nélkül nem praktikus alapértelmezett fejlesztési függőség.

## Modulonkénti ellenőrzés

1. Az illusztráció a már megírt jelenethez készüljön, ne találjon ki új kánont.
2. Minden tárgy/környezeti elem és kijárat legyen a rajzon, `artSpots` célponttal.
   Közös ajtó- és kijárati célpont használhat `environment` és `exit` azonosítót is.
3. Csak felfedezés után látható részlethez `glyph` használható. A rajz alaprétege
   ne tartalmazzon rejtett tárgyat vagy történeti titkot.
4. Az `actions` általános igéket kínáljon, ne megoldást vagy kombinációs receptet.
   A játék ezeket egységes kis ikonokkal mutatja, tooltip/hozzáférhető név mellett.
   Az `arrivalDiscoveries` adja az érkezéskor látható alap környezetet; rejtett
   tárgyhoz továbbra is vizsgálati felfedezés tartozzon. A vizsgálat adjon konkrét
   érzéki/fizikai leírást, ne egy általános sikertelenségi üzenetet vagy megoldási
   parancsot. A sikertelen kísérlet legyen rövid, ne sorolja a nem történt károkat.
5. Az inventoryhoz rövid, egyértelmű `itemArt` készüljön. Stabil tárgyazonosítót
   és korábban megszerzett történetkönyvlapot nem szabad átírni.
6. Ellenőrizd a koordinátákat, keskeny képernyős görgetést, billentyűzetet,
   érintést, felfedezést, tárgyfelvételt, használatot és kombinálást.
7. A story steward jóváhagyása és az összes teszt a végső bájtokra vonatkozzon.

Nem töltünk le modellt, nem vezetünk be modellhívást játék közben, és privát
storyboard nem kerül külső szolgáltatáshoz vagy generált kép metaadataiba.
