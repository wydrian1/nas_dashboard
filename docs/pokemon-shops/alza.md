# Alza — Pokémon kártyák

Elemzés: 2026-10-01. **Állapot: hozzáférés miatt blokkolt; nincs bekapcsolt adapter, automatikus Alza-lekérés vagy baseline.** A GameRunner működését nem módosítottuk.

## Megadott nézet

https://www.alza.hu/jatekok/pokemon-kartyak/18879069.htm#f&availabilityFilterValue=2&cud=0&pg=1&prod=

- Kategóriaazonosító: `18879069`, cím: „Pokémon kártyák”.
- A `#` utáni rész URL-fragment: nem kerül bele a HTTP-kérésbe. A sima HTML-letöltés tehát nem a kért szűrt listát adja.
- Böngészőben a JavaScript alkalmazza az `availabilityFilterValue=2` szűrőt. A megfigyelt kijelölés: **„Készleten az Alza.hu-nál”**, nem „Minden termék”.
- A nézetben 6 termék látható, egy oldalon; mindegyiken aktív „Kosárba” gomb van. Jelenleg négy album/mappa és két kártyavédő, nem booster/ETB/display.
- A szűretlen, külső elemzőeszközzel olvasható HTML `#lblNumberItem` értéke 209, és tartalmaz `rel="next"` hivatkozást az `18879069-p2.htm` oldalra. Ez **nem** a szűrt készletes lista mérete vagy lapozása.
- A szűrt böngészős DOM `#lblNumberItem` értéke 6, `#pagerbottom` aktuális oldala 1. A szűrt többoldalas működés még nincs élőben igazolva.

## Hozzáférési akadály

A Windows-gépről, a worker tervezett saját `WydrianMonitor/1.0 (personal stock monitor)` User-Agentjével végzett normál, hitelesítés nélküli HTTP-próba:

| Cím | Eredmény |
| --- | --- |
| `https://www.alza.hu/robots.txt` | HTTP 403, HTML |
| `https://www.alza.hu/jatekok/pokemon-kartyak/18879069.htm` | HTTP 403, HTML |

A robots.txt szabályai így nem ellenőrizhetők. A 403 pontos oka nem ismert; nem állítjuk, hogy a robots külön tiltja a kategóriát. A külső elemzőeszköz kategórialekérése és a szokásos böngészős megnyitás működött, de ez nem bizonyítja, hogy a külön Windows-worker engedélyezett vagy működőképes hozzáférést kapna.

**Nem használunk másnak álcázott User-Agentet, proxyváltást, exportált böngészős cookie-t vagy CAPTCHA-megoldást.** Nem próbálgatunk alternatív API-végpontokat az elutasítás kikerülésére. A felhasználó külön jóváhagyásával egyszeri, normál headless böngészős kompatibilitási próba is történt, az alábbiak szerint. Nincs ismétlődő Alza-lekérés vagy ütemezett böngészős automatizálás.

Folytatáshoz az Alza által támogatott/engedélyezett API vagy termékfeed, illetve igazoltan engedélyezett automatizált hozzáférés kell. Az adatforrásnak a kategóriát, készletszűrőt, stabil azonosítókat és a teljes lapozást is megbízhatóan közölnie kell. A hozzáférés megoldása után újra kell ellenőrizni a robots/felhasználási feltételeket és a friss katalógussémát.

## Egyszeri Playwright + headless Chromium próba

2026-10-01 00:43 (Europe/Budapest), a felhasználó kifejezett jóváhagyásával:

- Playwright `1.63.0`, a hozzá tartozó Chromium `153.0.8010.12` alapértelmezett headless indítással.
- Friss, nem tartós böngészőkörnyezet; nincs meglévő böngészőhöz kapcsolódás, cookie-import, User-Agent-átírás, stealth-beállítás vagy proxy.
- Egyetlen kategóriamegnyitás a teljes, felhasználó által megadott fragmenttel. Nem kattintottunk kosárgombra és nem oldottunk meg ellenőrzést.
- **Eredmény: a fő HTML-dokumentum HTTP 403-at adott.** A próba azonnal lezárta az oldalt és a böngészőt, nem próbálta újra. A készletszűrő és a termékek ezért nem olvashatók ki ebből a próbából.
- A normál headless Chromium önmagában tehát ezen a gépen nem oldotta meg a hozzáférést. A 403 pontos oka továbbra sem azonosított.
- Diagnosztikai script: `scripts/Probe-Alza-Playwright.mjs`; JSON-eredmény: `.runtime/research/alza-playwright-probe.json`. A script csak kézzel indítható; a worker és a dashboard nem importálja.
- A Playwright és a böngészők elkülönítve, a `.runtime/alza-probe` mappába kerültek. A dashboard fő csomagfájljai, Windows-szolgáltatásai és az adatbázis nem változtak. A JSON-jelentés nem tartalmaz cookie-t, hitelesítési adatot vagy teljes hálózati naplót.

Az Alza továbbra sincs bekapcsolva. A próba nem hozott létre baseline-t, eseményt vagy e-mailt.

## Megfigyelt nyilvános adatstruktúra

Ezek elemzési megfigyelések, **nem éles adapterszerződés**:

- Termékkártya: `#boxes .box[data-id][data-code]`.
- Stabil ID: `data-id`, SKU: `data-code`. A megfigyelt kártyákon `data-almostnew="false"`; új/felbontott/használt változatok külön kezelése később tisztázandó.
- Termékcím/link: `a.name`, például `/jatekok/pokemon-up-sv03-obsidian-flames-a5-d9930234.htm`. A linkben lévő numerikus ID egyeztethető a kártya ID-jával.
- Kosárgomb: `a.btnk1`, szövege „Kosárba”. A kártya `canBuy` osztálya kiegészítő jelzés, nem önmagában elérhetőségi döntés.
- A kosárgomb href-je **JavaScript**, pl. `javascript:Alza.Web.Controls.Box.boxOrder(9930234, ...)`. Ezt csak szövegként lehet ellenőrizni; sem végrehajtani, sem terméklinkként megjeleníteni nem szabad. Nem kattintottunk kosárgombra, nem módosítottunk kosarat.
- Ár: `.js-price-box__primary-price__value`, például `3 890 Ft`, nem törhető szóközökkel. A tagsági/kedvezményes árak elkülönítését a majdani adapter előtt külön vizsgálni kell.
- Készletfelirat: `.avl .avlVal`, pl. „Raktáron > 10 db”. A felhasználói szabály továbbra is aktív kosárgomb = elérhető; a felirat tájékoztatás.
- Kép: a megfigyelt termékképek `https://image.alza.cz/products/...` eredetűek; későbbi adapterben külön engedélylista szükséges.
- A szűrő DOM-jában `input[type="radio"][value="2"]` van a `label.checked` / `.Mui-checked` elem alatt. A JavaScript által beállított `checked` tulajdonság nem feltétlenül jelenik meg HTML-attribútumként.
- Az aktuális lap: `#pagerbottom a.pgn[aria-current="page"]`, szűrt esetben `pgb1`.
- A böngésző normál betöltése során megfigyelt szűrési kérés útvonala: `/Services/EShopService.svc/Filter`. Nem indítottunk rá külön automatizált kérést; a hozzáférési szerződés és a paraméterek nem ellenőrzöttek, így nem kezeljük támogatott publikus API-ként.

## A megfigyelt hat termék

| ID | SKU | Termék | Ár |
| --- | --- | --- | --- |
| 9930234 | HRAls5807 | Pokémon UP: SV03 Obsidian Flames A5 | 3 890 Ft |
| 7814562 | HRAls1833 | Pokémon UP: GS Scorching Summit – gyűrűs mappa | 6 590 Ft |
| 9930233 | HRAls5806 | Pokémon UP: SV4.5 Paldean Fates A5 | 3 890 Ft |
| 7814564 | HRAls1831 | Pokémon UP: SV02 Paldea Evolved – A5 album | 3 890 Ft |
| 7590517 | HRAkc05219 | Pokémon UP: GS Snorlax Munchlax – Deck Protector tok, 65 db | 4 290 Ft |
| 7590521 | HRAkc05221 | Pokémon UP: GS Frosted Forest – Deck Protector tok, 65 db | 4 290 Ft |

Pillanatfelvétel, nem élő készletígéret. Nem kerültek a monitor adatbázisába, nem küldtünk róluk értesítést. Ha csak tényleges kártyatermékeket szeretnénk figyelni, a kiegészítőkre külön kizárási szabály szükséges; a kategórianév önmagában nem elegendő.

## Megvalósítás előtt szükséges lépések

1. Engedélyezett, megbízható adatforrás megszerzése; 403 esetén nem aktiválunk scrapert.
2. A készletszűrő pontos visszaigazolása a kapott adatokban, nem pusztán a megadott URL-fragment alapján.
3. Teljes, többoldalas katalógus és változatok ellenőrzése; részleges eredmény nem lehet baseline.
4. Sanitizált tesztminták készítése az elfogadott forrásból, aktív/inaktív gombbal, előrendeléssel és lapozással.
5. A jelenleg GameRunnerre kötött tároló, dashboardműveletek és worker webshoponkénti általánosítása. Az események, lease-ek, beállítások és levélsorok nem keveredhetnek a források között.
6. Csendes első Alza-baseline; a meglévő GameRunner-baseline és adatok megőrzése. Csak ezután automatikus figyelés.
