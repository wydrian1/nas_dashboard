# Pokémon webshopfigyelő — modulterv

Állapot: az első GameRunner-adapter, összehasonlító motor, külön Windows-worker, dashboard és SMTP-kimeneti sor elkészült. Az e-mail-küldés külön konfigurációhoz és engedélyezéshez kötött, alapból kikapcsolva. A következő részek az eredeti modultervet őrzik; az első verzió konkrét szabályai és korlátai: `pokemon-shops/gamerunner.md`, üzemeltetés: `../README.md`.

Második forrás elemzése: `pokemon-shops/alza.md`. Az Alza normál HTTP-próbája és a külön jóváhagyott egyszeri Playwright/headless Chromium próba is HTTP 403-at adott, ezért a forrás nincs bekapcsolva; a böngészőben korábban megfigyelt készletszűrő és termékazonosítók dokumentálva vannak.

MythGames: `pokemon-shops/mythgames.md`. A felhasználó itt külön listaalapú szabályt adott: a készletszűrt listán való szereplés az elérhetőség, külön kosárgomb-/termékoldal-ellenőrzés nélkül. A HTTP-adapter teljes próbája 15 terméket adott; a közös motor/UI több webshop önálló kezelésére bővült. Az alábbi általános tervnél az egyes webshoplapok konkrét szabályai az irányadók.

Pöttyös Zebra: `pokemon-shops/pottyoszebra.md`, teljes próba 23 termék két oldalon, aktív kosárgombos szabállyal. A Pokémon UI külön, Google-belépéssel védett `/pokemon` oldalra költözött; a fő dashboardon csak a navigációs hivatkozása marad. Az oldal tetején mindegyik webshop legutóbbi 60 elérhetőségi eseménye szerepel, globális időrendben, webshop-/eseménytípus-szűréssel. Baseline-termékekből nem gyártunk „új” eseményeket. Alatta a három webshop külön kártyája, ütemezése és beállításai.

**A Pöttyös Zebra + külön oldal bővítés élesítve:** az első megszakított UAC után a felhasználó kérésére újraindított jóváhagyás és telepítés sikeres. A Pöttyös Zebra baseline 23 termék/2 oldal, a korábbi két webshop baseline-ja és beállításai megmaradtak. Mindhárom e-mail-kapcsoló kikapcsolva. Az aggregált eseménylista jelenleg üres, mert a baseline nem újdonságesemény.

GrandLine: `pokemon-shops/grandline.md`. A robots.txt tiltja a megadott `stock=1` URL automatikus lekérését, ezért a worker kizárólag a megengedett szűretlen kategóriát és natív lapozását használja, helyi aktív-kosárgombos szűréssel. A kategóriaelemzés 164 termék/14 oldal, ebből 37 rendelhető. Az adapter a negyedik webshopként készül, saját baseline-nal és a meglévő `/pokemon` aggregált nézettel; az élesítés állapota a webshoplapján szerepel.

Krodom Cards: `pokemon-shops/krodomcards.md`. A megadott nézet 284-es összes-termék kategória + 80-as Pokémon gyártó, nem készletszűrés; 242 kártya/11 oldal. A kosárgomb állapota alapján szűrünk. A „button-add-to-cart” osztályú „Értesítés” várólistagomb külön kizárandó, nem aktív kosárgomb. A GrandLine és Krodom bővítése együtt kerül élesítésre, külön baseline-okkal; az állapot a webshoplapokon szerepel.

**GrandLine és Krodom élesítve:** sikeres UAC-telepítés, 70/70 teszt és build. Friss HTTP-workerbaseline: GrandLine 37 termék/14 oldal, Krodom 70 termék/11 oldal. Mind az öt webshop rendben, összesen 157 elérhető termék; korábbi baseline-ok és beállítások megmaradtak. A baseline-ok nem hoztak létre eseményt vagy levélmunkát; minden e-mail-kapcsoló kikapcsolva.

## Cél és felépítés

Legújabb elemzés: TCG Futár, Sport Kártya Bolt, RT Collectors Club és Cardverse adapterei elkészültek (`pokemon-shops/` lapok). Teljes HTTP-próbák: 1 / 9 / 6 / 20 elérhető termék. TCG Futárnál külön aktív kosárgomb és kumulatív `infinite_page` teljesség (12 → 16 kártya), RT-nél kifejezett felhasználói listaalapú kivétel, tiltott rendezés/üres árszűrők nélkül. CollectKing HTTP 403, REGIO termék nélküli keresőváz miatt nincs bekapcsolva; nem mentettünk nulla készletes baseline-t. Az élesítés állapota az egyes webshoplapokon szerepel.

### Négy új webshop élesítése — 2026-10-01

97/97 teszt sikeres, típusellenőrzés és `.next-staging` production build sikeres. UAC-jóváhagyott `scripts/Deploy-Pokemon.ps1` kilépési kódja 0; konzisztens SQLite-mentések és korábbi build megtartva (`.next-backup-20261001-162333`). Mindhárom szolgáltatás automatikus és Running; a Pokémon worker LocalService, dashboard/HTTPS továbbra is LocalSystem, IIS változatlan.

Éles ellenőrzés 14:24 UTC: mind a 12 shop `ok`, összesen **227 elérhető termék**, mindhez kép/ár. Négy új önálló csendes baseline: TCG Futár 1, Sport Kártya Bolt 9, RT Collectors Club 6, Cardverse 20. A korábbi nyolc baseline és összes felhasználói beállítás változatlan. Nulla termékesemény és levélsorfeladat, SMTP nincs konfigurálva, minden e-mail kapcsoló kikapcsolva. Worker heartbeat aktív. Bejelentkezés nélkül helyben és nyilvános HTTPS-en a `/pokemon` 307 a főoldalra, az `/api/pokemon` 401, a főoldal 200. Friss Google-belépés hiányában hitelesített vizuális felületi ellenőrzés nem történt. Diagnosztika: `.runtime/research/pokemon-four-new-shops-deployed.json`.

Új bővítés: JátékNet (`pokemon-shops/jateknet.md`), Reflexshop (`pokemon-shops/reflexshop.md`) és GeekEmpire (`pokemon-shops/geekempire.md`). Teljes adapterpróbák: 11 / 9 / 14 elérhető termék. A JátékNet tiltott `f=` címe nem lett lekérve; az engedett teljes kategóriából helyi címválasztás, a Pokémon-számlálóval egyező darabszámmal. Reflexshopnál a megadott keresésben három általános kártyavédő is szerepel. GeekEmpire-nél 5 másodperces robots-késleltetés, kosárlink-lekérés nélkül. A jelenleg teljes egyoldalas listákat támogatjuk, új lapozás esetén hibával megőrizzük az előző állapotot. Az élesítés állapota a három webshoplapon szerepel.

**Mindhárom új webshop élesítve:** 83/83 teszt, typecheck és build, sikeres UAC-telepítés (0). Friss csendes workerbaseline-ok 11 / 9 / 14 termékkel, mindegyik egy oldalon, teljes kép-/áradattal. Mind a nyolc webshop rendben, összesen 191 termék; a korábbi öt baseline/beállítás megmaradt. Nincs baseline-esemény vagy levélmunka; SMTP nincs konfigurálva, minden e-mail-kapcsoló kikapcsolva. Privát oldal/API anoniman 307/401 helyben és publikus HTTPS-en is; a worker LocalService és működik.

Magyar webshopok kijelölt Pokémon-kínálatának időszakos figyelése. Az újonnan elérhető, megvásárolható termékekről e-mailes értesítés készül. Minden webshopot előzetesen külön elemzünk, majd saját statikus adapterrel támogatunk. Futás közben nincs szükség AI-ra.

```text
Dashboard (Google-belépés)
  ├─ Webshopok, szűrők, gyakoriság, ki-/bekapcsolás
  ├─ Termékek, változások, értesítési előzmények
  └─ Kézi vizsgálat → feladatütemezés

Külön Windows-worker, automatikus indulással
  ├─ Tartós ütemező → webshoponkénti adapterek
  ├─ Validálás → normalizált állapot → változásdetektálás
  └─ Tartós e-mail-kimeneti sor → külső levélküldő

SQLite (WAL, rövid tranzakciók, busy_timeout)
```

A worker nem függ az oldal megnyitásától vagy a böngészőtől. Nem a Next.js-oldalletöltés vagy egy Server Action végez hosszú webshopvizsgálatot. A worker alacsony jogosultságú Windows-szolgáltatásként fut, a Caddy és a meglévő médiaszolgáltatások módosítása nélkül. A kezdeti UI és worker ugyanazt a helyi adatbázist használhatja; íráskor rövid tranzakció és zárolási várakozás szükséges. Az új táblák migrációja telepítéskor történik, nem versengő workerindításokban.

## Mit tekintünk új elérhetőségnek?

| Változás | Alapértelmezett működés |
| --- | --- |
| Első sikeres vizsgálat | Kiinduló állapot mentése, nincs tömeges értesítés |
| Korábban ismeretlen termék készleten jelenik meg | „Új készletes termék” értesítés |
| Már ismert, korábban nem rendelhető termék készletre kerül | „Újra / most készleten” értesítés; külön kikapcsolható |
| Továbbra is készleten | Nincs újabb levél |
| Ár vagy cím változik | Naplózható, de önmagában nem küld levelet |
| Új, de elfogyott termék | Mentés, értesítés majd elérhetőségkor |
| Előrendelhető termék | Külön státusz; értesítése alapból kikapcsolva |
| Hiányos / hibás vizsgálat | Nincs készletváltozás és nincs termékértesítés |

Az „elérhető” nem pusztán azt jelenti, hogy van termékoldal vagy kategóriakártya. Az adapter webshoponként ellenőrzi a rendelhetőséget: készletjelzés, aktív kosárgomb, strukturált adat vagy nyilvános katalógusválasz. Az előrendelés, a „hamarosan”, az „értesítést kérek” és az „elfogyott” nem azonos a készlettel. Ismeretlen állapotot nem alakítunk automatikusan készletessé.

A készlet visszatérésének engedélyezése egy induló termékértesítési döntés, nem külön motor. A kód mindkét eseményt támogatja, a felületen külön kapcsolók lesznek.

## Webshoponkénti előzetes elemzés

Minden forráshoz egy rövid, verziózott elemzési lap készül:

1. Domain, kijelölt Pokémon-kategóriák, felhasználási feltételek és robots.txt ellenőrzése. Csak engedett, nyilvánosan elérhető adatok; nincs login-, CAPTCHA- vagy botvédelmi megkerülés.
2. A katalógus forrásának azonosítása: nyilvános API / JSON, JSON-LD, szerveroldali HTML vagy JavaScriptből betöltött adat. Ezt az adott oldalon külön vizsgáljuk.
3. Lapozás, végtelen görgetés és teljes kínálat feltérképezése. A vizsgálat nem maradhat csak az első oldalon.
4. Stabil termékazonosító meghatározása: webshopbeli ID vagy SKU, szükség esetén kanonikus URL. A cím nem azonosító.
5. Variánsok és csomagok elkülönítése: nyelv, kiadás, darabszám, booster / display / ETB. Egy termékoldal több külön rendelhető változatot is képviselhet.
6. Készletállapotok mintáinak rögzítése: készletes, elfogyott, előrendelhető, hamarosan, ismeretlen. Szükség esetén a termékoldalt is lekérjük.
7. Ár-, pénznem- és terméklink-felismerés. Az ár opcionális: hiányzó ár ne akadályozza az egyébként megbízható értesítést.
8. Anonim HTML/JSON tesztminták, készletállapot- és lapozási tesztek készítése. Nem mentünk felhasználói cookie-t, authadatot vagy személyes rendelési információt.
9. Statikus adapter implementálása és összevetése néhány valós termékkel.
10. Első teljes vizsgálat, baseline mentése, majd az automatikus figyelés engedélyezése.

Új domain hozzáadása nem „bármilyen URL” bevitele és azonnali scraping: az első verzióban csak már elemzett, adapterrel támogatott forrás választható. A domain és az adapter kódbeli, ellenőrzött engedélylistán szerepel.

## Adapterkontraktus

```ts
type Availability = "in_stock" | "out_of_stock" | "preorder" | "unknown";

interface ShopConfig {
  categories: string[];      // az adapter engedélyezett kategóriaazonosítói
  includeKeywords: string[];
  excludeKeywords: string[];
}

interface ObservedProduct {
  externalID: string;       // webshop + termék/variáns stabil kulcsa
  title: string;
  url: string;              // kanonikus termékoldal
  variant?: string;
  availability: Availability;
  priceHuf?: number;        // validált forintár, ha megbízható
}

interface ScanResult {
  products: ObservedProduct[];
  coverage: "complete" | "partial";
  scannedAt: string;
  pagesVisited: number;
  warnings: string[];
}

interface ShopAdapter {
  id: string;
  version: string;
  scan(config: ShopConfig, signal: AbortSignal): Promise<ScanResult>;
}
```

Az adapter csak adatot ad vissza. Nem küld e-mailt, nem ütemez és nem ír közvetlenül a termékállapot-adatbázisba. Így minden forrás azonos összehasonlítási és értesítési szabályokat kap.

Ajánlott könyvtárszerkezet:

```text
lib/pokemon/
  types.ts
  adapters/<webshop>.ts
  fetch-policy.ts
  comparison.ts
  repository.ts
  mailer.ts
worker/pokemon-monitor.ts
tests/fixtures/pokemon/<webshop>/
docs/pokemon-shops/<webshop>.md
```

## Lekérdezés és ütemezés

- Alapérték: 10 perc/webshop, forrásonként állítható 5–60 perc között, a forrás korlátait tiszteletben tartva. Szükség esetén ennél ritkább ellenőrzés.
- Kis véletlen időeltolás; oldalanként legalább 1–2 másodperc szünet. Legfeljebb két webshop párhuzamosan; egy webshopon belül nincs párhuzamos teljes vizsgálat.
- HTTP-időkorlát, maximális oldalméret, lapozási felső korlát és teljes vizsgálati időkorlát. A korlát elérése részleges eredmény, nem teljes baseline.
- 429 esetén Retry-After, átmeneti hibáknál növekvő várakozás. A worker nem kísérli meg ugyanazt az oldalt más identitással vagy proxyval kikerülni.
- ETag / Last-Modified használata, ha az adott forrás támogatja és a teljes lekérési folyamatban értelmezhető.
- A következő esedékesség, futó munka és lejáró lease tartósan tárolt. Újraindítás után folytatható; elavult lease visszavehető.
- A dashboard Kézi vizsgálat gombja munkát ütemez, nem indít új konkurens scrapert.
- Először egyszerű HTTP-feldolgozás. Böngészős automatizálás csak indokolt forrásnál, külön erőforrás-korláttal; ezen a NAS PC-n nem indítunk minden webshophoz folyamatos Chromiumot.

## Hibák és hamis riasztások kezelése

- A 200-as HTTP-válasz önmagában nem siker: loginoldal, CAPTCHA, üres sablon vagy hibás JSON nem katalógus.
- Megváltozott szelektor, irreális termékszámcsökkenés, duplikált kulcs és befejezetlen lapozás hibát/részleges vizsgálatot eredményez.
- Részleges vagy hibás vizsgálat nem írja felül az utolsó jó állapotot, nem nullázza a készletet és nem hoz létre értesítést.
- Egy termék eltűnése nem azonnali elfogyás: megerősítő termékoldallekérés vagy két teljes sikeres vizsgálat szükséges, adaptertől függően.
- Ismeretlen elérhetőség nem szünteti meg a korábbi biztos állapotot. A forrás egészsége külön figyelmeztetést kap.
- Teljes baseline-csere vagy szűrő/kategóriakör bővítése csak tudatos kezeléssel: új kiinduló állapot, nem régi termékek tömeges „új” levele.
- Adapterfrissítésnél megőrizzük a stabil termékkulcsokat. Ha az azonosítási módszer szükségképpen változik, migráció vagy új baseline szükséges.
- Gyors készletki/be változásokra termékenként legalább 30 perces értesítési cooldown állítható.

## Tárolás és változásdetektálás

Tervezett táblák:

- `pokemon_shops`: adapter, kategóriák/szűrők, gyakoriság, aktív állapot, baseline állapot.
- `pokemon_products`: webshop + stabil kulcs, cím/link/variáns/ár, biztos elérhetőség, először/utoljára látva, elérhetőségi epizód, eltűnés-megerősítés.
- `pokemon_scans`: kezdés/vég, adapterverzió, teljesség, termékszám, hiba, következő futás.
- `pokemon_events`: új készletes termék / készletre visszatérés / opcionális előrendelés, korábbi és új állapot.
- `pokemon_mail_outbox`: levélcsomag, eseményhivatkozások, állapot, próbálkozások, következő újrapróbálás, szolgáltatói azonosító.

Az érvényes összehasonlítás, a termékállapot frissítése, az esemény és a kimeneti levélsor bejegyzése egy rövid adatbázis-tranzakció. A hálózati lekérés és a levélküldés nem tartja nyitva az írótranzakciót.

Egyedi eseménykulcs: webshop + termék/variáns + elérhetőségi epizód + eseménytípus. Így ugyanaz az állapot nem hoz létre újra meg újra levelet. Valódi elfogyás és készletre visszatérés új epizód, ezért külön értesíthető.

Hosszú távon a részletes vizsgálati naplók gördülő megőrzést kapnak, pl. 90 nap; a termékkulcsokat és fontos értesítési előzményeket nem töröljük automatikusan úgy, hogy régi termék újként jelenhessen meg.

## E-mail

- Külső szolgáltató (például Resend/Brevo) vagy hitelesített SMTP, nem saját publikus levélszerver a PC-n.
- A Google dashboard-belépés nem ad Gmail-küldési jogosultságot. A levélküldést külön konfiguráljuk; ha Gmail SMTP-t választunk, annak külön támogatott hitelesítése kell.
- Saját feladói domainhez SPF/DKIM, és lehetőleg DMARC. Nem nyitunk bejövő SMTP-portot a NAS-on.
- Kezdeti címzettnek a `wydrian@gmail.com` javasolt, de küldés csak a címzett és a szolgáltató beállítása, majd engedélyezés után indul.
- Kulcsok/jelszavak helyi, védett konfigurációban; soha nem a böngészőben, a termékadatokban vagy a Gitben.
- Egy vizsgálat új termékei webshoponként egy összefoglaló levélben, nem termékenként külön e-mailben.
- Tartalom: webshop, esemény típusa, terméknév, variáns, ár ha ismert, közvetlen link, észlelés ideje. HTML mellett szöveges változat, minden külső szöveg escape-elve.
- Kimeneti sor állapotai: queued / sending / sent / failed. Hiba esetén korlátozott, növekvő várakozású újrapróbálás, pl. 2/10/30/120 perc.
- A szolgáltató általi elfogadás nem bizonyítja a postaládába érkezést. Ha a szolgáltató támogat webhookot, a kézbesítési/bounce állapot később beépíthető.
- Teljes, pontosan egyszeri kézbesítés SMTP-n nem garantálható: elfogadás utáni timeout ritkán duplikációhoz vezethet. API-s idempotenciakulcs használata ajánlott, ahol támogatott.
- Külön, kézzel indított tesztlevél és az utolsó küldés/hiba megjelenítése a dashboardon. Az első baseline nem tesztlevél és nem riasztás.

## Dashboard

Új „Pokémon figyelő” szekció:

- Webshopkártyák: aktív/szüneteltetett, utolsó sikeres ellenőrzés, következő futás, készletes termékek száma, adapterhiba.
- Új elérhetőségi események listája, webshop- és időszűrő, termék megnyitása.
- Támogatott webshop hozzáadása, kijelölt kategória/szűrő és gyakoriság beállítása.
- Értesítéskapcsolók: új készletes termék, készletre visszatérés, előrendelés.
- Manuális vizsgálat, szüneteltetés, baseline újrafelvétele megerősítéssel.
- E-mail beállítási állapot, tesztlevél, küldési előzmény és sikertelen kézbesítési kísérlet.

Minden privát végpont és művelet Google-munkamenetet és az engedélyezett felhasználót ellenőriz. A workernek nincs publikus API-ja. A webshopok csak engedélylistás domainekre és nyilvános címekre kérdezhetnek, az átirányításokat is ellenőrizve.

## Megvalósítási sorrend és átvételi tesztek

1. **Egy webshop elemzése és adaptere.** Készlet, elfogyás, előrendelés, variáns és lapozás tesztmintákkal.
2. **Motor és tartós worker.** Baseline, összehasonlítás, deduplikáció, ütemezés és újraindítás utáni folytatás.
3. **Dashboard és e-mail-kimeneti sor.** Először küldés nélküli eseménynapló; utána szolgáltatói tesztlevél, végül értesítések engedélyezése.
4. **További webshopok egyenként.** Minden új forrásnak saját dokumentum, adapter és tesztcsomag.

Kötelező átvételi esetek: első vizsgálat nem küld termékriasztást; változatlan állapot nem küld ismét; új készletes termék egyszer kerül sorba; valódi visszakészletezés külön esemény; hibás/részleges vizsgálat nem okoz hamis átmenetet; újraindítás nem veszít munkát/eseményt; levélküldési hiba után a sor újrapróbálható; a UI nem indít konkurens vizsgálatot.

## Induláshoz szükséges döntések

1. A webshopok pontos URL-jei, lehetőleg a figyelni kívánt Pokémon-kategória linkjével.
2. Csak Pokémon TCG (booster, ETB, display stb.) vagy minden Pokémon-termék?
3. Készletre visszatérésről is kérsz levelet? Előrendelhető termékekről is?
4. A javasolt 10 perces alapgyakoriság megfelel-e az adott oldalak szabályainak és a kívánt figyelésnek?
5. Maradjon-e az értesítési címzett `wydrian@gmail.com`, és melyik levélküldési megoldást használjuk?

Az első két adat alapján elindítható az első webshop elemzése. Nem kezdünk automatikus figyelést vagy e-mail-küldést pusztán a tervezés kérésére.
