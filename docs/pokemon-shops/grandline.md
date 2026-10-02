# GrandLine — Pokémon

Elemzés: 2026-10-01. Shoptet szerveroldali HTML, a Windows figyelőgépről HTTP 200. A teljes nyilvános kategória **164 egyedi termék, 14 oldal**, ebből **37 aktív kosárgombos termék**. A kategória „Raktáron” számlálója szintén 37; az elemzésben nem volt „Raktáron”/előrendelési jelzésű, de kosárgomb nélküli kártya.

Állapot: **élesítve**, a Krodom Cards bővítésével együtt, sikeres UAC-jóváhagyás után. A friss worker első teljes scanje csendes baseline-t mentett: 37 termék, 14 oldal, `status=ok`, hiba nélkül. A korábbi három webshop baseline-ja és beállításai megmaradtak; e-mail kikapcsolva.

Az adapter közvetlen, teljes 14 oldalas HTTP-próbája sikeres: 37 rendelhető termék, 37 kép és HUF-ár, mindegyik raktári jelzéssel. A diagnosztikai eredmény nem írta át a futó adatbázist; az éles baseline külön, friss HTTP-vizsgálatból készült.

## Megadott cím és megengedett adatforrás

Felhasználói/böngészős link:

https://www.grandline.hu/pokemon/?stock=1

**A robots.txt tiltja a `stock` paraméteres cím automatikus lekérését** (`Disallow: /*?stock`). Ezt a címet nem kértük le, és a worker engedélylistája sem engedi. Nem rendezünk át paramétereket, nem használunk szűrőbeállító `/action/` végpontot, API-t vagy cookie-importot a tiltás kikerülésére.

Az általános `User-agent: *` csoport viszont engedi a nyilvános, szűretlen `/pokemon/` kategóriát és a natív `/pokemon/oldal-2/` stb. lapozást. **A figyelő ezeket olvassa, majd helyben választja ki az aktív kosárgombos termékeket.** Minden oldalnál robots-ellenőrzés és legalább 1500 ms szünet; a robots.txt naponta gyorsítótárazható. A robots-szabály technikai crawl-engedély, nem általános jogi felhasználási engedély.

Elérhetőség: a korábban megadott általános szabály szerint aktív „Kosárba” gomb, beleértve az aktív gombos előrendelést. A készletszöveg és schema.org elérhetőség információ; nem írja felül a gomb állapotát. A „Bővebben” gomb önmagában nem rendelhetőség. A megfigyelt 37-es egyezés nem a tiltott készletszűrt HTML külön lekérésének eredménye, és nem garantáljuk, hogy a két szabály jövőbeli előrendelések esetén is azonos listát ad.

## Feldolgozási szerződés

- Adapter: `lib/pokemon/adapters/grandline.ts`, verzió `1.0.0`, webshopazonosító `grandline`.
- Felhasználói link: `GRANDLINE_URL`; workerforrás: `GRANDLINE_CATALOG_URL` (`https://www.grandline.hu/pokemon/`).
- Kötelező `body.type-category.in-pokemon.id-811`, Pokémon `h1`, létező és **nem kijelölt** `#stock[name="stock"]`.
- Első oldal kanonikus linkje a szűretlen kategória. A webshop a lapozott oldalakon nem ad canonicalt; ott a header, aktuális oldalszám és az előző/következő `head link[rel=prev/next]` együttesen igazolja a lapozást. Ha van canonical, annak egyeznie kell.
- Összegzés: `.category-header-pagination`, „Oldal 1/ 14 - összesen 164 termék”; aktuális oldal: `.pagination__currentPage`.
- Fő lista: `#products.products-block > .product`, közvetlen `.p[data-micro="product"]` kártyával.
- Stabil termék-ID: `data-micro-product-id`; SKU: `[data-micro="sku"]`. Egy katalóguskártya egy termék, nem külön variánsértesítés.
- Cím/terméklink: `a.name[data-micro="url"]`. A saját HTTPS webshop termékútvonala engedett, követési paraméterek/fragment nélkül. Nem kosár- vagy checkout-link.
- Kosárgomb: `.p-tools button.btn-cart`, aktív submit, „Kosárba” szöveggel. A hozzá tartozó form helyi `/action/Cart/addCartItem/` POST-űrlapja és rejtett `productId` értéke csak **HTML-ből ellenőrzött adat**, soha nem küldünk POST-ot vagy hajtjuk végre az űrlapot.
- Hiányzó/disabled gomb nem elérhető. Kosárűrlap meglévő, de megváltozott gombstruktúra hibát ad, nem üres állapotot.
- Ár: `[data-micro="offer"]` `data-micro-price` értéke, csak HUF pénznem mellett; opcionális, hibás/idegen érték `null`.
- Kép: `a.image img[data-src]`, vagy tényleges HTTPS `src`; kizárólag `https://cdn.myshoptet.com/usr/www.grandline.hu/user/shop/…`. A `data:image/svg+xml` helykitöltőt nem használjuk képként.

## Teljesség, korlátok és üzemeltetés

Az összes kategóriakártyát számoljuk és deduplikáljuk, **az elfogyottakat is**, bár a termékállapotba csak a rendelhetők kerülnek. A teljes darabszámnak és oldalszámnak minden lapozott válaszban egyeznie kell; az első oldal méretéből ellenőrizzük az összes oldal méretét és a végső teljes kártyaszámot. Ismétlődő elfogyott kártya is hibát okoz, nem csak ismétlődő elérhető termék.

Most 12 kártya/oldal, az utolsó oldalon 8. A workerscan 14 kategóriaoldalt kér le, nem 37 külön termékoldalt. Általános korlátok: 600 kategóriakártya, 50 oldal, 20 s/HTTP-kérés, 3 MiB/HTML, 3 perc/teljes workerscan. A letöltő kizárólag a www-s HTTPS origin robots.txt és pontos kategória/lapozási útvonalait engedi; nincs query, fragment, tetszőleges termékoldal/API vagy idegen originre átirányítás. Nyilvános DNS-cím ellenőrzése és rögzítése kötelező.

Tízperces alapütemezés, 5–60 percre állíthatóan; ez a teljes 14 oldalas kategória vizsgálata. Önálló baseline, lease, backoff, termékállapot és események; közös eltűnés-/nagyesés-védelem. Az új elérhetőségek a `/pokemon` oldal közös felső eseménylistájába is bekerülnek, GrandLine jelöléssel. A baseline nem újdonságesemény, nem küld tömeges levelet.

Tesztek: `tests/grandline.test.ts`, anonim Shoptet-struktúra: `tests/fixtures/pokemon/grandline/catalog.html`. Külön tesztek: a tiltott készletszűrt URL-t soha nem kérjük le; csak engedett lapozás; teljes kártyaszám és ID-uniqueness (elfogyottaknál is); aktív gomb és ID-egyezés; biztonságos ár/kép/link; webshoponkénti baseline, aggregált esemény, levélnév és hibakezelés.

Élesítés: 70/70 teszt, typecheck és production build sikeres; telepítés kilépési kódja 0. Dashboard/HTTPS/worker Running, a worker LocalService. A privát snapshot öt önálló webshopot és 157 elérhető terméket ad, a baseline-ok után nincs új esemény vagy levélmunka. Anonim `/pokemon` 307 átirányítás a belépőoldalra, anonim `/api/pokemon` 401. A korábbi böngészős munkamenet továbbra is lejárt; bejelentkezett vizuális ellenőrzést nem állítunk, auth-bypass nélkül teszteltünk.
