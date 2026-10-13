# NULLPONT — folytatásos szöveges kaland

## Alapelv

**Nincs tervezett vége.** Új fejezetek, rejtélyek, helyszínek és szereplők
folyamatosan hozzáadhatók. A történetet AI alkotja, részletes felhasználói
storyutasítások nélkül; a már megszerzett nyomokból és nyitott kérdésekből építkezik.
Egy megfejtés új lehetőségeket nyit, nem lezáró game over képernyőt.

Menüpont: **NULLPONT · Kalandjáték**, útvonal: `/adventure`. Minden engedélyezett,
belépett felhasználó játszhat, más dashboard-jogosultságot nem kap.
ASCII jelenet → eseményszöveg → kattintható műveletek és tárgyválasztók.
Felszerelés, emléktöredékek és lenyitható, könyvszerű **Történetkönyv**.

Most a nyitószoba játszható: vizsgálódás, felvétel, kombinálás, tárgyhasználat,
beszélgetés, veszélytelen támadási kísérlet, ajtónyitás és oda-vissza mozgás.
A folyosó a következő fejezet csatlakozási pontja. Amíg nincs új fejezet publikálva,
a játék ezt világosan jelzi és megtartja az állást. Nincs halál, időlimit vagy
végleges elakadás. A nyitány egyszerűbb bevezető, nem a későbbi rejtvények felső határa.

## Tartalomfüggetlen motor

- `lib/adventure/types.ts`: a fejezetek deklaratív szerződése.
- `lib/adventure/engine.ts`: általános, tiszta állapotátmenet, nem történeti switch.
- `lib/adventure/chapters/awakening.ts`: az első fejezet képei, tárgyai,
  szabályai, dialógusai, feltételei, következményei és elbeszélő mérföldkövei.
- `lib/adventure/catalog.ts`: fejezetregiszter és tartalomvalidálás. Az új
  fejezet `connections` mezője új kijáratot adhat régi helyszínhez, az eredeti
  fejezet átírása nélkül. Duplikált azonosító, hibás tárgy/célhelyszín elutasítva.
- Nincs maximális fejezetszám, fix helyszín-union vagy előre lefoglalt történeti vég.
  A fejezeteket hozzáadjuk, nem lecseréljük. A régi azonosítók stabilak maradnak.

A műveletek feltételei: meglévő/hiányzó tárgy és történeti zászló. Következményeik:
tárgyadás/kombinálás, zászló, mozgás, emléktöredék és opcionális könyv-mérföldkő.
A kliens csak egy műveletazonosítót és revíziót küld, nem írhatja a játékállást.

## Automatikus Történetkönyv

A `book` tartós, időrendben bővülő emléklap-sorozat. A program a fontos
mérföldkő első teljesülésekor automatikusan elteszi az AI által megírt,
első személyű, összefüggő prózát. A lap a fejezetcímet, címet, szöveget,
stabil mérföldkőazonosítót és lépésszámot őrzi. A kezdő ébredés is egy lap.

A hétköznapi kattintás, ismételt beszélgetés vagy újrahasznált tárgy nem gyárt
új lapot. A napló nem parancslista és nem spoiler: csak ténylegesen elért
eseményeket ír le. A megszerzett nyomok külön, rövid emléktöredékekben látszanak.
Az elmentett könyvlap szövegét későbbi tartalomfrissítés nem írja át.

## Mentés és hozzáférés

`adventure_saves` a meglévő SQLite-adatbázisban. Hitelesített, normalizált
e-mailhez kötve, szerveroldalon. Az adatbázis szokásos mentésének része,
GitHubra nem kerül. Állapot: sémaverzió, helyszín, tárgyak, zászlók,
emléktöredékek, történetkönyv, utolsó esemény, lépésszám.

Minden elfogadott művelet atomi, revízióhoz kötött SQL-frissítés. Elavult
böngészőfül friss mentést kap, nem írhatja felül. Dupla kattintás helyben blokkolt.
Újratöltés és új eszköz pontosan a szerveren elfogadott állást folytatja.
Minden szerverakció `requireUser()`-t hív; az eszköz visszavonását is ellenőrzi.
A Next.js saját eredetellenőrzése védi a szerverakció POST-kéréseit.

Hiba esetén nincs optimista előrelépés. Bizonytalan hálózati válasznál újratöltés
a biztos állapot. Hibás/jövőbeli séma nem törlődik. Új fejezethez nem kell
mentésreset; állapotséma-váltáshoz explicit, adatmegőrző migráció szükséges.

## AI-val készülő folytatások munkamenete

A mostani AI-tartalomalkotás fejlesztéskor történik, nem játék közbeni, külső
modellhívással. Nincs hozzáadott API-kulcs, fizetős háttérszolgáltatás vagy
játékosadatot továbbító integráció. Futásidejű AI-generálás külön bővítés lehet;
akkor is validált fejezeteket és egyszer elmentett könyvlapokat kell használnia,
nem tetszőleges generált kód végrehajtását.

Ha az AI feladata egyszerűen „folytasd a játékot”, részletes storyterv nélkül:

1. Olvassa el ezt a dokumentumot és a publikált fejezeteket. A valós felhasználói
   adatbázist nem kell olvasnia. A tartalom és szintetikus tesztállapot elég.
2. Válasszon szabadon egy nyitott rejtélyt; készítsen fordulatos új fejezetet.
   Ne határozzon meg végső befejezést. Tartsa fenn a kánont, vagy az ellentmondást
   tegye szándékos, a játékban feloldható rejtéllyé.
3. Új `chapters/<topic>.ts` modul: névterezett, stabil azonosítók, ASCII-képek,
   leírások, tárgyak, NPC-szabályok, többlépcsős rejtvények és könyvlapok.
4. `connections`-ben csatlakozzon például a `threshold` helyszínhez; regisztrálja
   a modult a `CHAPTERS` listában. A játékmotort és régi mentéseket ne írja át.
5. Bizonyítsa tesztekkel a régi mentés folytathatóságát, az új rejtvények
   megoldhatóságát és a mérföldkövek egyszeri naplózását. Tartsa be az AGENTS.md
   tesztelési és GitHub-PR munkamenetét. Élesítés külön jóváhagyás.

## Nyitott történeti szálak — SPOILER

7314-ben ébredsz. Kilenc heg, kilencedik ébresztés. ŐR–0 szerint önként kérted
a karantént és az emléktörlést, mégis holnapi dátum szerepel a kérelmen.
A zárban a hangod volt, bár nem beszéltél. Tizenkét szobából a saját hangod szól,
miközben a rendszer egyetlen személyt lát. Az ajtó belül 09, kívül 90.
Az üveg mögött betűk mozognak: „Az archívum nem a múltat őrzi.”

Lehetséges, nem kötelező irányok: Palimpszeszt állomás; NARA javítódrón, aki egy
sosem létezett kert emlékét kéri; elágazó jövőket őrző archívum; saját, korábbi
döntéseidből származó ellenfelek. Ezek nem előre rögzített végkifejletek.

## Rejtvényszabályok

- A nehézség az összefüggések felismerése, nem véletlen kattintási sorrend.
- Kritikus tárgy nem veszhet el. Hibás használat nem fogyaszt semmit.
  Több feladathoz szükséges összetevőnél visszabontás vagy alternatív megoldás kell.
- NPC-ellenségeskedésből mindig van visszaút, jóvátétel vagy alternatív hozzáférés.
- Új nyomok visszaolvashatók. A fejezet végén új szálak nyílnak, nem végleges vég.
- Minden új ág minden elérhető állapotból folytatható legyen.

## Ellenőrzés és bemutatás

`npm test`, `npm run typecheck`,
`DASHBOARD_BUILD_DIR=.next-staging npm run build`, `npm run test:browser`.
A böngészőteszt külön, szintetikus adatbázist és loopback szervert használ.
Opcionális `ADVENTURE_SCREENSHOT_DIR` mellett asztali és mobil nyitóképet készít.
Éles bemutatáshoz külön, jóváhagyott telepítés szükséges.
