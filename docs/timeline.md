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

A forrás a **sessionelőzmények, a Git-történet és a projekt dokumentációja**,
2026. október 10-ig. Csak nagyobb funkciók és összefüggő fejlesztési mérföldkövek
szerepelnek: nem PR-/commit-lista, nem apró javítások vagy tesztszámok gyűjteménye.
Az első Git-pillanatkép (`365b0a5`, október 3. **01:19**, Budapest) már működő
alkalmazást tartalmazott. A fejlesztés szeptember 30-án indult.

### A GitHub előtti történet ellenőrzése

Az eredeti dashboard-session felhasználói kéréseit **és** sikeres megvalósításról,
élesítésről szóló válaszait olvasási módban visszakerestük. Egy kérés vagy terv
önmagában nem bizonyít elkészült funkciót. A táblázat dátumai Budapest szerintiek;
a kérések, a kész állapot és az első Git-pillanatkép külön események.

| Funkció | Sessionben rögzített bizonyíték | Forrás a kezdeti kódban / dokumentációban |
|---|---|---|
| HTTPS, Google-belépés, szolgáltatásállapotok, RSS | Szept. 30. 21:53–21:56 kérés; 22:33 éles visszaellenőrzés | Kezdeti forrás: auth, dashboard, feeds |
| CPU/RAM/tárhely, képes RSS, időjárás, gyorslinkek, jegyzetek | Szept. 30. 22:49, 23:05 és 23:46 sikeres válaszok | Kezdeti rendszerállapot-, időjárás- és napi eszközmodulok |
| Pokémon-worker és közös készletoldal | Okt. 1. 00:31 működő worker; 14:32 külön oldal; 16:24 már 12 webshop | `lib/pokemon`, `docs/pokemon-monitor-plan.md` |
| Android és szerveroldali push | Okt. 1. 22:33 kérés; 23:22 aláírt APK és éles szerver | `android`, `docs/android-app.md` |
| Admin / Pokémon-reader | Okt. 2. 17:48 éles jogosultságellenőrzés | `docs/roles.md` |
| Excelből pénzügyi modul | Okt. 2. 22:36 kérés; 23:05 elkészült és éles | `docs/finance.md` |
| Korai LEGO-nyilvántartás, pénzügyi előtöltés | Okt. 2-i kérés; okt. 3. 00:10 éles előtöltés | Kezdeti pénzügy és LEGO-adatmodell |
| RAID-költözés | Okt. 3. 00:16 sikeres költözés és megőrzés | `docs/project-move.md` |
| Titkosított napi Drive-backup és helyreállítás | Okt. 3. 01:03 Drive-ról letöltött próba-visszaállítás, napi mentés | `docs/backups.md`, `docs/disaster-recovery.md` |

A távoli OpenCode szeptember 30-án még elhalasztott ötlet volt, **nem** kész funkció;
az október 3-i PR 2 igazolja a működő hozzáférést. Az e-mailes készletértesítés
kezdeti terv maradt, majd a push kiváltotta. Home Assistant és a blokkolt boltok
nem szerepelnek elkészült funkcióként. Az eredeti session nyers tartalmát, fiókjait,
fájlútvonalait, portjait, privát számait és azonosítóit nem másoljuk a bemutatóba.

### GitHub utáni nagyobb bővítések

- Október 3.: tulajdonosi OpenCode és eToro-előtöltés (PR 2, 4–5).
- Október 4–9.: kereshető, 15 boltra bővített készletfigyelő; Metagames,
  TCG Bolt és Bloomrift; október 6-tól háromperces alapidőköz (PR 6–7, 9, 22, 30).
- Október 6.: határidő-push, ellenőrzött Android-frissítő, Fontos infók és
  info-reader (PR 11–12).
- Október 7.: külön Gyűjtemények, nominális/reálgyarapodás, BrickEconomy és
  mentett/aktuális értékek; admin fájltároló megosztásokkal (PR 16–17, 19, 21, 23).
- Október 7–8.: fájltörlés és rendezhető tartalmi blokkok, közös rendezőnyíl-kapcsoló,
  továbbfejlesztett telefonos fájlhasználat (PR 24, 27–28).
- Október 9.: hitelesített mobil boltszabályok; új, ellenőrzött boltokhoz nem kell
  boltonként új APK az egyszeri 1.1.4-frissítés után (PR 30).

Utolsó ellenőrzött kiadás: **Web 1.4.6 / Android 1.1.4**. A boltok aktuális
üzemállapotát és a telefonra ténylegesen telepített verziót a timeline nem állítja.
A valódi telefonos értesítésnyitás és a külső gyűjteményimport visszaigazolása
nem helyettesíthető szerver-/szimulációs teszttel. Ez a timeline-frissítés nem
szerepel már élesített új alkalmazásfunkcióként.

### Mintapromptok

Két rövid, **átfogalmazott, nem szó szerinti** minta a 12. dián:
szeptember 30. 21:53 + 21:56 (dashboard + Google-belépés), illetve
október 1. 22:33 (Android WebView + Firebase-push).
A személyes domaint, fiókot, infrastruktúra-azonosítókat és titkokat kihagyjuk.
A promptokat nem teljes sessionexportként, hanem a cél megfogalmazásának példájaként közöljük.

A képek ehhez a bemutatóhoz készített, eredeti SVG-illusztrációk, nem éles képernyőképek.
A termékek, pénzügyi összegek, fájlok és telefonképernyők szintetikusak.
Nincs valódi import, felhasználó, eszközazonosító, hitelesítési adat vagy működő megosztási link.

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
