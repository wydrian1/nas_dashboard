# NULLPONT — leválasztott, folytatásos kaland

A játék önálló alkalmazás: **[`apps/nullpont`](../apps/nullpont/README.md)**.
A teljes telepítési, mentésimport-, jogosultság-, release- és rollback-leírás ott van.
Ez a könyvtár a dashboard nélkül is másolható és telepíthető: saját package-lock,
saját Google-belépés/süti, saját `nullpont.sqlite`, saját build és saját 3100-as port.
Sem a játékmotor, sem a futó alkalmazás nem importál dashboard-modult.

## Felület

- **Mozgás:** ismert kijáratok és körülnézés. Zárt ajtóhoz is megpróbálhatsz odamenni.
- **Akció:** általános igék, nem előre elárult helyes lépések.
- **Környezet:** csak a már felfedezett elemek; új részlet vizsgálódás után jelenik meg.
- **Inventory:** kattintással forrástárgy, majd környezeti vagy másik tárgy célpont.
  Kombinálásnál nincs előre kiírt recept vagy várható eredmény.
- **Emléktöredékek és Történetkönyv:** a fontos mérföldkövek első elérésekor
  automatikusan megőrzött, első személyű próza. Régi könyvlap nem íródik át.

## A dashboard kapcsolata

A dashboard nem futtat játékot és nem ír játékállást. Opcionális `NULLPONT_URL`
csak egy HTTPS-hivatkozást ad az önálló alkalmazásra. Régi `/adventure` bookmark
hitelesítés után oda irányít; beállított új cím nélkül költözési tájékoztatót mutat.
A régi `adventure_saves` táblát nem töröljük, nem módosítjuk és nem olvassuk az
alkalmazásból. A külön import parancs kizárólag egy konzisztens backupot olvas.
Az éles migráció/új szolgáltatás/HTTPS-beállítás külön jóváhagyott telepítési lépés.

## Nyitott történet

Nincs tervezett vég. A fejezetekhez folyamatosan új helyszínek, rejtélyek, NPC-k és
mérföldkövek csatlakozhatnak. AI írja a folytatásokat, részletes storyutasítás nélkül,
a már publikált kánon és nyitott kérdések alapján. Futásidejű fizetős AI-integráció
nem került hozzáadásra. Egy megfejtés új lehetőségeket nyit, nem game overt.

Új modul: `apps/nullpont/lib/game/chapters/<nev>.ts`; regisztráció a `catalog.ts`-ben.
`connections` új kijáratot és interakciót csatlakoztat régi helyszínhez, átírás nélkül.
Új helyszín környezete, kijáratai, dialógustémái, felfedezései és műveletmintái
deklaratív tartalom. Stabil azonosítók és adatmegőrző sémamigráció kötelező.
Minden új ág folytathatóságát és minden mérföldkő egyszeri naplózását teszt igazolja.

## Kánon — SPOILER

7314-ben ébredsz. Kilenc heg, kilencedik ébresztés. ŐR–0 szerint önként kérted a
karantént és az emléktörlést, mégis holnapi dátum szerepel a kérelmen. A zárban a
hangod volt, bár nem beszéltél. Tizenkét szobából saját hangod szól, miközben a
rendszer egyetlen személyt lát. Az ajtó belül 09, kívül 90. Az üveg mögött betűk:
„Az archívum nem a múltat őrzi.” Ezek nyitott szálak, nem rögzített végkifejlet.

## Ellenőrzés

Dashboard: `npm test`, `npm run typecheck`, staging `npm run build`, `npm run test:browser`.
Önálló játék, `apps/nullpont` alatt: ugyanezek a parancsok; illetve
`npm run package:release -- --destination <uj-abszolut-konyvtar>`.
Mindkét böngészőteszt szintetikus adatbázist használ, éles felhasználó helyett.
