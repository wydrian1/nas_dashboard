# Nyilvános fejlesztéstörténeti bemutató

Célcím: **https://wydrian1.github.io/nas_dashboard/** (GitHub Pages), bejelentkezés nélkül.
Önálló, magyar nyelvű, 14 diás statikus oldal. Nincs alkalmazásmenü, privát adat,
NAS API-hívás, analitika vagy külső kép/font. A NAS nem szolgálja ki a bemutatót.
A célcím csak sikeres Pages-deployment és HTTP-/böngészős ellenőrzés után tekinthető élőnek.

## Felépítés

- Bemutató: `docs/history-site/index.html`, `style.css`, `presentation.js`, `assets/*.svg`.
- Favicon és fejlécikon: `assets/brand-w-modules.svg`, byte-azonos a dashboard
  `public/brand-w-modules.svg` ikonjával. A régi `mark.svg` nem kerül az artifactba;
  az új fájlnév a korábban cache-elt bemutatóikont sem használja újra.
- Zárt publikálható fájllista és csomagoló: `scripts/Build-Timeline-Pages.mjs`.
  Csak a 12 ellenőrzött forrásfájlt és a generált `.nojekyll` fájlt teszi a friss,
  gitignored `.timeline-pages/` könyvtárba; idegen/hiányzó fájlnál, symlinknél vagy
  meglévő célkönyvtárnál leáll. A teljes repository vagy `docs/` nem publikálható.
- Workflow: `.github/workflows/timeline-pages.yml`. Csak `main`-ről telepít;
  releváns változásra automatikusan, illetve kézi indítással. A külön build job
  ellenőrzi a bemutatót és a publikációs határt; csak utána tölti fel a szűk artifactot.
  A deploy job kizárólag `pages: write` és `id-token: write` jogot kap.
  Az actionök pontos commitra rögzítettek; nem kell NAS-elérés vagy külön titok.
- Minden HTML-asset hivatkozás relatív: a `/nas_dashboard/` projektprefix alatt és
  helyi fájlként is működik, nincs NAS-os `/timeline/`-átírás vagy API-függőség.
- A korábbi `app/timeline/*` adapterek és `lib/timeline-site.ts` megszűntek;
  a bemutató nem része a Next-buildnek. Éles webfrissítés után a NAS `/timeline`
  és assetútvonalai 404-et adnak, nincs átirányítás vagy második kiszolgált példány.
  A Gitben tárolt dokumentációs forrás megmarad, nem élő NAS-oldalként.
- A privát dashboard, pénzügy, gyűjtemények, fájlkezelés és reader-jogosultságok nem
  változnak. A nyilvánosság csak a bemutató zárt fájllistájára vonatkozik.

## Használat

- `←` / `→`, Page Up / Down: lapozás; Home / End: első / utolsó dia.
- Mobilon vízszintes húzás; az Idővonal gombbal fejezetválasztó.
- `N`: előadói jegyzet; `F`: teljes képernyő, ha a böngésző engedélyezi.
- Nyomtatáskor minden dia külön oldalra kerül; JavaScript nélkül egymás alatt olvashatók.
- Közvetlen diahivatkozás: `https://wydrian1.github.io/nas_dashboard/#chapter-04`.

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
node scripts/Build-Timeline-Pages.mjs
npm test
npm run typecheck
$env:DASHBOARD_BUILD_DIR='.next-staging'
npm run build
```

A csomagoló új célkönyvtárat igényel; ismételt ellenőrzéshez a korábban generált
`.timeline-pages/` tartalmat külön, célzottan kell eltávolítani, nem a forrást.
A dokumentációs teszt ellenőrzi a publikálható fájlok zárt listáját, a relatív
forráshivatkozásokat, az illusztrációkat, az offline működést, a navigációt és
a nyomtatási/no-JS szabályokat. A `tests/timeline-pages.test.ts` az artifact
pontos fájllistáját/forrásazonosságát, a projektprefixet, az idegen/hiányzó forrás
elutasítását, a friss célkönyvtárat és a NAS-adapterek hiányát ellenőrzi.
HTTP-próbán a Pages-cím **session nélkül** 200, minden kép/JS/CSS elérhető,
de más dokumentum vagy privát fájl nem kerülhet az artifactba.

A böngészős ellenőrzés minden diát desktop és mobil szélességen vizsgál,
fejezetválasztással, jegyzetekkel, nyomtatással és kikapcsolt JavaScripttel is.
Átállás külön merge/élesítési engedély után:

1. GitHub repository **Settings → Pages → Source: GitHub Actions**. Az oldalnak
   elérhetőnek kell lennie; nem a `main /docs` branch-alapú publikálását használjuk.
   A tulajdonos állítja a repository láthatóságát; a workflow ezen nem változtat.
2. Merge után a workflow publikálja az artifactot. A futásnak sikeresnek kell lennie,
   a deployment által visszaadott címen ellenőrizni kell az anonim oldalt/asseteket,
   a 14 fejezetet, a két promptot, a mobilos használatot és a 14 oldalas nyomtatást.
3. **Csak működő Pages-oldal után** aktiváljuk a NAS tesztelt, aláírt webes csomagját,
   amely eltávolítja a régi route-okat. Mindkét NAS-domainen `/timeline` és korábbi
   assetjei 404-et kell adjanak; a privát oldalak, adatok és jogosultságok maradnak.
   A worker és az APK nem változik. A régi webbuild csak a szokásos rollback-mentés.
