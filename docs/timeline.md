# Nyilvános fejlesztéstörténeti bemutató

Célcím: **https://wydrian.hu/timeline**, bejelentkezés nélkül.
Önálló, magyar nyelvű, 14 diás statikus oldal. Nincs alkalmazásmenü, privát adat,
NAS API-hívás, analitika vagy külső kép/font. Nem GitHub Pages.

## Felépítés

- Bemutató: `docs/history-site/index.html`, `style.css`, `presentation.js`, `assets/*.svg`.
- Statikus adapterek: `app/timeline/route.ts`, `app/timeline/[...asset]/route.ts`.
- Zárt fájllista és válaszok: `lib/timeline-site.ts`.
- Mindkét adapter `force-static`: a HTML és az összes engedélyezett asset **buildkor**
  előállított válasz. Az assetlista `generateStaticParams`-ból származik;
  `dynamicParams=false`, nincs általános dokumentum- vagy fájlkiszolgáló.
- A build HTML-asset hivatkozásait `/timeline/` alá igazítjuk, hogy a `/timeline`
  cím záró perjel nélkül is működjön. A forrás önmagában, helyi fájlként is használható.
- A HTML és a képek/JS/CSS a lezárt `.next-staging` build részei. A webes élesítő
  ugyanúgy hash-ellenőrzött csomagban viszi őket, nem kell új Caddy-szolgáltatás.
- A privát dashboard, pénzügy, gyűjtemények, fájlkezelés és reader-jogosultságok nem
  változnak. A nyilvánosság csak a bemutató zárt fájllistájára vonatkozik.

## Használat

- `←` / `→`, Page Up / Down: lapozás; Home / End: első / utolsó dia.
- Mobilon vízszintes húzás; az Idővonal gombbal fejezetválasztó.
- `N`: előadói jegyzet; `F`: teljes képernyő, ha a böngésző engedélyezi.
- Nyomtatáskor minden dia külön oldalra kerül; JavaScript nélkül egymás alatt olvashatók.
- Közvetlen diahivatkozás: `/timeline#chapter-04`.

## Forrás és képek

A forrás a Git-történet és a projekt dokumentációja, 2026. október 7-ig.
Az első Git-pillanatkép (`365b0a5`, október 3.) már működő alkalmazást tartalmazott;
nem állítjuk, hogy azon a napon kezdődött a teljes fejlesztés.
A commitok a fejlesztési mérföldköveket, nem feltétlenül az élesítés napját jelölik.
Rövid, tényszerű szöveg. A frissítés tartalmazza a PR 18–23 éles kiadásait:
1.4.0, nyilvános timeline, BrickEconomy, TCG Bolt mint 14. webshop,
és 1.4.1 mentett/aktuális gyűjtemény-összehasonlítás. A most készülő feladat
nem szerepel már élesített funkcióként. A privát importok eredményét nem publikáljuk.

A képek ehhez a bemutatóhoz készített, eredeti SVG-illusztrációk, nem éles képernyőképek.
A termékek, pénzügyi összegek, fájlok és telefonképernyők szintetikusak.
Nincs valódi import, felhasználó, eszközazonosító, hitelesítési adat vagy működő megosztási link.
A 287 teszt / 141 HTTP-próba az október 7-i kombinált funkciókiadás történeti eredménye,
nem a bemutató saját tesztszáma vagy egy jövőbeli kiadás ígérete.

## Ellenőrzés és élesítés

```powershell
node --test docs/history-site.test.mjs
npm test
npm run typecheck
$env:DASHBOARD_BUILD_DIR='.next-staging'
npm run build
```

A dokumentációs teszt ellenőrzi a publikálható fájlok zárt listáját, a relatív
forráshivatkozásokat, az illusztrációkat, az offline működést, a navigációt és
a nyomtatási/no-JS szabályokat. A route-tesztek a MIME-típusokat, a buildkori
előállítást, az assethivatkozásokat és az idegen fájlnevek tiltását is ellenőrzik.
HTTP-próbán a built route **session nélkül** is 200, minden kép/JS/CSS elérhető,
de idegen dokumentum, privát fájl vagy útvonalbejárás nem adható ki.

A böngészős ellenőrzés minden diát desktop és mobil szélességen vizsgál,
fejezetválasztással, jegyzetekkel, nyomtatással és kikapcsolt JavaScripttel is.
Élesítés a szokásos tesztelt/aláírt webes csomaggal, külön merge/élesítési engedély
után. A célcím csak sikeres aktiválás és mindkét domainen elvégzett anonim HTTP-próba
után tekinthető élőnek. A repository privát marad.
