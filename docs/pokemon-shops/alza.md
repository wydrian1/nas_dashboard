# Alza — Pokémon kártyák

Megvalósítás: 2026-10-17. **Külön Alza-adapter készült, alapból szüneteltetve. A tulajdonos külön kérésére az Alza nem kéri/ellenőrzi a robots.txt-t; más boltok működése nem változik.** A normál Chromium a tényleges `LocalService` workerfiókkal, nem interaktív Windows-környezetben is sikeresen igazolt hat terméket. Nincs éles Alza-baseline vagy ütemezett Alza-forgalom; az élesítés és bekapcsolás külön jóváhagyást igényel.

## Mobil adapter és ellenőrzött szabályok

Forrás: `https://m.alza.hu/jatekok/pokemon-kartyak/18879069.htm?availabilityFilterValue=2`.

- A készletszűrő valódi queryparaméter, nem desktop URL-fragment. Kizárólag ez az egy kategóriacím lehet böngészős navigációs cél; nincs robots-, API-, termékoldal-, kosár-, belépés- vagy archívumlekérés.
- Az egyszeri, friss, **látható Chromium** 2026-10-17-én HTTP 200-at kapott, CAPTCHA nélkül. A DOM-ban **6 ennyiből: 208**, egy aktív szűrő, hat egyedi termék, mindegyiken „Raktáron > 10 db” és nem letiltott „Kosárba” gomb szerepelt. Négy album/mappa és két kártyavédő volt a listán; a kategória összes ilyen termékét figyeljük, nincs booster/ETB-kizárólagosság.
- A korábbi diagnosztika desktop szelektorai nem illettek a mobil DOM-ra; az akkori időtúllépés nem bizonyított betöltési hibát vagy CAPTCHA-t. A mentett valódi DOM offline feldolgozása a mostani parserrel mind a hat terméket, árat és azonosítót igazolta.
- Mobil séma: `#categoryPage h1`, `meta[property="og:url"]`, `.commodity-count`, `.button-filter__count`, `#itemsContainer > .js-box.item[data-id]`, `.item__name`, `a.item__link-top`, `.js-price-withVat`, `.item__availability`, `button.js-buy[data-id]`, `img.item__image`.
- A kategória, pontos szűrős meta-URL, egyetlen aktív szűrő, egyező pozitív darabszám és egyedi numerikus ID kötelező. A terméklink `-d<ID>.htm` és a kosárgomb ID-ja egyezzen. SKU-ként a mobil oldalon igazolt numerikus termékazonosító szolgál; desktop SKU-t nem találunk ki.
- Csak igazolt „Raktáron” feliratú kártyából lesz készlet. A parser kizárja a letiltott/rejtett gombokat és őseiket; a böngésző a tényleges CSS-láthatóságot is ellenőrzi, kattintás nélkül. Előrendelést nem következtetünk a névből; ez a készletszűrt adapter `in_stock` termékeket ad.
- A nyilvános, egyértelmű Ft-árat olvassuk, nem a kedvezményes/member-árat; ismeretlen ár `null`. Opcionális kép csak az `https://image.alza.cz/products/` eredetről engedett.
- **Jelenleg csak a teljes egyoldalas lista támogatott.** A mobil `rel=next` a megfigyelt teljes listán az **Archív** oldalra mutatott, ugyanazzal a készletszűrővel; azt nem követjük. A query nélküli archív link is csak figyelmen kívül hagyott archívum lehet, navigáció soha. Nem egyező darabszám, valódi/ismeretlen lapozás, hiányos DOM, nem igazolt nulla találat vagy minden gomb rejtettsége hiba, soha nem részleges/üres baseline. A többoldalas szerződést élőben még nem igazoltuk.

## Háttérfuttatás és hozzáférési kapu

- A worker nem használja a felhasználó asztalát, böngészőprofilját vagy cookie-jait. Külön, rövid életű Chromium indul friss kontextussal; nincs stealth, UA-átírás, proxyváltás, CAPTCHA-megoldás vagy mentett session. A vizsgálat végén és megszakításkor a böngésző bezárul.
- **Windows alatt alapból normál (`headed`) Chromium fut a szolgáltatás saját, nem interaktív munkamenetében**, nem a bejelentkezett asztalon. Ez a mód a tényleges `LocalService` fiókkal is sikeresen feldolgozta a hat terméket. Más rendszeren alapból headless; explicit operátori felülbírálás: `ALZA_BROWSER_MODE=headed` vagy `headless`. Más érték hiba. A headless mód ezen a NAS-on a kategórián is 403-at kapott; automatikus módváltás/fallback vagy ismétlés nincs.
- Külön tulajdonosi utasítás alapján **nincs Alza robots.txt-kérés, robots-cache vagy robots-alapú tiltás**. A 2026-10-17-i korábbi robots-próba 403-at adott, így annak tartalmát/szabályait nem állítjuk ismertnek. Az ettől független tényleges HTTP-elutasítás vagy CAPTCHA továbbra is megállítja a vizsgálatot. A többi adapter robots-kezelése változatlan.
- Csak rögzített, felülvizsgált Alza/CDN-erőforrások tölthetők be, nyilvános DNS-címekre rögzítve. XHR/fetch, POST, websocket, service worker, idegen host, belépés/kosár és privát HTTP-cél blokkolt; WebRTC közvetlen UDP nem engedett, a Chromium sandboxa bekapcsolva marad. Nincs rejtett API-fallback. A közös HTTP-fetch policy is csak a készletszűrt kategóriacímet engedi.
- A 403/CAPTCHA `protected`, a 429 `rate_limited`, a többi sikertelen/hiányos olvasás hiba. Az eddigi termékek és a baseline megmaradnak; a közös worker hibavárakozása és a `Retry-After` érvényes. A többi webshop és a személyes értesítési szabályok nem változnak.
- Az adatbázis-regisztráció **INSERT OR IGNORE**, `enabled=0`, `status=paused`; egy már létező Alza-sor beállításait újraindításkor sem írja át. Az első teljes baseline csendes, utána a meglévő új/újrakészletezett esemény- és telefonos pushrendszer működik. Az Android dinamikus hostlistája csak `m.alza.hu`-t enged az Alzához; nem kell APK- vagy párosításmódosítás.

## Telepítési előfeltételek — nem automatikus élesítés

1. A Playwright `1.64.0` futásidejű függőség. Az azonos verzió Chromiumját külön kell telepíteni: `node node_modules/playwright/cli.js install chromium`. A böngészőbinaris nem kerül Gitbe vagy a web/worker forráscsomagjába.
2. A telepítést és a worker környezetét azonos, privát `PLAYWRIGHT_BROWSERS_PATH` könyvtárra kell állítani (például a NAS `.runtime/pokemon-browsers` mappájára). A dedikált workerfióknak csak ehhez a binárisfához szükséges olvasás/végrehajtás és saját tempkönyvtár írása kell; nincs új privátadat-könyvtárjog vagy magasabb szolgáltatásjog.
3. Azonos verziójú futásidejű csomagok és böngésző szükségesek a workernek is, nem csak a fejlesztői worktree-nek (`npm ci --omit=dev` a külön jóváhagyott telepítés részeként). A Chromiumot **a tényleges szolgáltatásfiókkal** ellenőrizni kell. Egyszeri, adatbázis-/értesítésmentes operátori próba: `node scripts/Probe-Alza.ts --live`. A `LocalService`-próba izolált forrás-/binárismásolattal sikeres: **6 termék, 1 oldal**, nincs termelési DB, telefonforgalom vagy szolgáltatásmódosítás. Ez műszaki hozzáférési bizonyíték, nem az Alza felhasználási feltételeinek jóváhagyása.
4. Csak külön jóváhagyott web+worker kiadás és a kapuk sikeres ellenőrzése után kapcsolható be az Alza a szokásos adminbeállítással. Sem ez a forrásváltoztatás, sem a tesztek nem indítanak éles figyelést vagy szolgáltatás-újraindítást.

## Tesztek

- `npm test`: szintetikus mobil HTML; szűrő, darabszám, ID/link/gomb egyezés, ár, kép, rejtett gomb, hibás/üres/lapozott lista, robots-lekérés hiánya, megszakítás és bezárás, szüneteltetett migráció, csendes baseline, új/újrakészletezett push és más boltok/párosítások/beállítások megőrzése.
- `node scripts/Test-Alza-Browser.mjs`: valódi Chromium, kizárólag route-olt szintetikus dokumentumokkal; CSS-láthatóság, scanner+reader együtt, robots-lekérés hiánya, 403/429, CAPTCHA, írás és privát hálózati kérés blokkolása. A kiadási ellenőrzés része, nincs külső webshop-/telefonforgalom.
- `node scripts/Test-Browser.mjs`: a beépített webalkalmazás Alza-panelje, szüneteltetett alapállapot és pontos mobil forráslink admin/olvasó nézetben, izolált szintetikus adatbázissal.

Az alábbi desktopfeljegyzések **2026-10-01-i történeti megfigyelések**, nem a mobil adapter sémája vagy jelenlegi készletígéret.

## Korábbi desktopnézet

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

A korábbi próba nem kapcsolta be az Alzát, és nem hozott létre baseline-t, eseményt vagy e-mailt.

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

## A korábbi vizsgálat folytatási feltételei

1. Engedélyezett, megbízható adatforrás megszerzése; 403 esetén nem aktiválunk scrapert.
2. A készletszűrő pontos visszaigazolása a kapott adatokban, nem pusztán a megadott URL-fragment alapján.
3. Teljes, többoldalas katalógus és változatok ellenőrzése; részleges eredmény nem lehet baseline.
4. Sanitizált tesztminták készítése az elfogadott forrásból, aktív/inaktív gombbal, előrendeléssel és lapozással.
5. A közös, azóta többwebshopossá bővített tároló, dashboard és worker elkülönített Alza-integrációja elkészült; az események, lease-ek és pushok nem keveredhetnek más forrásokkal.
6. Csendes első Alza-baseline; a meglévő GameRunner-baseline és adatok megőrzése. Csak ezután automatikus figyelés.
