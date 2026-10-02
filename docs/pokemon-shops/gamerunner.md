# GameRunner — Pokémon TCG

Adapter: `gamerunner`, verzió: `1.0.0`. Elemzés és élő próba: 2026-10-01.

## Kijelölt kör és elérhetőség

- Forrás: https://gamerunner.hu/gyujtogetos-kartyajatekok/pokemon-tcg?stockfilter=1
- Shoprenter, szerveroldali HTML. Nem kell JavaScript-végrehajtás vagy böngészős automatizálás.
- **Felhasználói szabály: aktív „Kosárba” gomb = elérhető.** A készletfelirat önmagában nem feltétel. Előrendelés és ismeretlen készletfelirat mellett is elérhető a termék, ha a kosárgomb aktív.
- Az élő próba 12 elérhető terméket talált: 10 „Raktáron”/„Utolsó N db raktáron”, 2 „Előrendelhető”. A „csak raktáron” szűrő tehát előrendeléseket is tartalmaz.
- Csak a kijelölt kategória és szűrő tartozik a figyeléshez. Nem a webshop összes Pokémon-terméke.
- A robots.txt általános szabálya `Allow: /`, külön tiltással az MJ12bot számára. A worker saját User-Agentet használ, és naponta újraellenőrzi a szabályokat. Nincs CAPTCHA/login/botvédelem megkerülése.
- A nyilvános vásárlási feltételek olvashatók; a robots engedélye önmagában nem szerződéses hozzájárulás. Megváltozott feltételek vagy tiltás esetén szüneteltetni kell a figyelést.

## HTML-szerződés

- Kategóriaőr: `body.category-list-body`, `.page-head-title` Pokémon-címmel, `#stockfilter-checkbox[checked]`.
- Termékkártyák: `#snapshot_horizontal > .product-snapshot`.
- Stabil kulcs: `input[name="product_id"]` értéke, egyeztetve az aktív `.button-add-to-cart[data-product-id]` értékével.
- A gomb szövege „Kosárba”; `disabled`, `.disabled` vagy `aria-disabled="true"` esetén nem elérhető. A kosárhivatkozásra soha nem küldünk kérést; nincs kosármódosítás vagy rendelés.
- Cím/link: `.product-card-title a`. Csak HTTPS, `gamerunner.hu`, egyszerű termékútvonal. A cím nem azonosító.
- SKU és ár: kosárgomb `data-product-sku`, `data-price-without-currency`. Ár opcionális, forint. Kép: `.product-card-image img[data-src]`, kizárólag `gamerunner.cdn.shoprenter.hu`.
- Készletfelirat: `.product-card-stock`, csak megjelenítéshez. „Előrendelhető” külön címke; más ismeretlen felirat esetén „Kosárba tehető”.
- A termékoldal azonosítója az összehasonlítás egysége. A Mini Tin/pokéball képen látható mintákat és a webshop által külön ID nélkül csoportosított változatokat nem bontjuk külön termékké.

## Lapozás, korlátok

`.sortbar-result-top .results`: `1 - 12 / 12 termék`. További oldalak: `&page=2`, stb. A listában összesen több kártya is lehet, mint az aktív kosárgombos találatok száma; a folytonosságot a kártyák, nem a találatok alapján ellenőrizzük.

Minden oldalt feldolgozunk, ellenőrizzük a stabil összlétszámot, folytonos tartományt és egyedi ID-kat. Ismételt vagy részleges oldal hibát ad. A lapozást tesztmintákkal is ellenőrizzük; az élő készletes lista jelenleg egyoldalas. Korlátok: 50 oldal, 600 kártya, 3 MiB/oldal, HTTP-kérésenként 20 másodperc, teljes vizsgálat 3 perc. Oldalak között legalább 1,5 másodperc vagy a robots Crawl-delay értéke.

Letöltés csak a fix kategóriára/robots.txt-re, ellenőrzött publikus DNS-címre rögzítve; az átirányítás is engedélylistás. Normál TLS-ellenőrzés. HTTP 429/Retry-After és növekvő hibavárakozás. Kézi vizsgálat nem kerüli meg ezt.

## Összehasonlítás és értesítés

- Első teljes vizsgálat: csendes baseline.
- Új aktív kosárgombos termék: új esemény. Előrendelés alapból szerepel, külön kikapcsolható az értesítésből.
- Előrendelhető → raktáron ugyanazzal az aktív gombbal: **nem új elérhetőség**, nincs új esemény.
- Eltűnés vagy inaktív kosárgomb két teljes vizsgálatban: nem elérhető. Ezután visszatérés: külön esemény, új epizód.
- 50%-nál nagyobb listacsökkenés: az előző állapot megmarad, amíg egy újabb teljes vizsgálat azonos ID-listával meg nem erősíti.
- Hibás vizsgálat nem írja felül a jó állapotot. Egyediség: webshop/ID/epizód. Termékenként egyórás levél-cooldown.
- Egy scan értesítései egy tartós levélcsomagba kerülnek. E-mail alapból kikapcsolva; régi eseményeket bekapcsolás után sem küldünk visszamenőleg.

## Tesztminták

`tests/fixtures/pokemon/gamerunner/available.html`: rövidített nyilvános HTML három valós termékkártyával, normál készlet/utolsó darabok/előrendelés. Nincs benne cookie, munkamenet vagy vásárlói adat. A tesztek ebből készítik az inaktív gombos, ismeretlen készletű, hiányos és kétoldalas változatokat.

`tests/pokemon.test.ts`: parser, lapozás, robots, baseline, egyszeri esemény/digest, visszatérés, hibás vizsgálat, összeomló katalógus, lease, kikapcsolt e-mail, tartós outbox és bizonytalan küldés visszatartása.
