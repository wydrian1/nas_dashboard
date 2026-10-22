# GeekEmpire — Pokémon Kártya

Elemzés és élesítés: 2026-10-01. **Élesítve**, a JátékNet és Reflexshop bővítésével együtt. Friss worker-baseline: 14 termék/1 oldal, 14 kép/ár, `status=ok`, hiba nélkül.

Felhasználó és worker címe:
https://geekempire.hu/termekkategoria/kartya/pokemon-kartya/

Robots.txt és kategória HTTP 200. A robots tiltja az `add-to-cart` paramétert, kosarat, pénztárt, fiókot és YITH-szűrőt. **Csak robots és a szűretlen kategória kérhető le**, a kosárlinkeket nem nyitjuk meg; nincs termékoldal-, API- vagy böngészős lekérés. A `Crawl-delay: 5` értékét betartjuk (legalább 5000 ms szünet).

Teljes kategória: **14 kártya egy oldalon**, mindegyiken aktív „Kosárba” gomb és HUF-ár. A végleges közvetlen adapterpróba 14 elérhető terméket, 14 képet és 14 HUF-árat adott. Képek saját WordPress feltöltések; az első kép rendes `src`, a többi Perfmatters lazy `data-src` (a `data:image/svg+xml` placeholder nem menthető kép).

## WooCommerce-kontraktus

Adapter: `lib/pokemon/adapters/geekempire.ts`, verzió `1.2.0`, webshopkulcs `geekempire`.

- `body.tax-product_cat.term-pokemon-kartya`, „Pokémon Kártya” h1 kötelező. A webshop **két canonical tagot** ad: a kért kategória és egy régi `/termekkategoria/pokemon-kartya/` alias. Csak ezt az ismert párt engedjük; a kért canonical kötelező, a régi alias nem workerforrás.
- Teljesség: `.woocommerce-result-count` „Mind a(z) N találat megjelenítve”; `ul.products > li.product` darabszáma N. Nem figyelünk meg csak egy részoldalt teljes eredményként.
- Stabil ID: kártya `post-ID` osztály, egyező gomb `data-product_id` és `add-to-cart=ID`. SKU: `data-product_sku`.
- Cím és terméklink: közvetlen `.woocommerce-loop-product__link`, `.woocommerce-loop-product__title`, kizárólag saját HTTPS `/termek/slug/` URL.
- Aktív „Kosárba” gomb: közvetlen `a.button.product_type_simple.add_to_cart_button`, a kártya ID-jével egyező cél. **A linket csak HTML-ből olvassuk, nem kérjük le.** Disabled/hidden gomb nem rendelhető. Készletszöveg tájékoztató; „Készleten” → `in_stock`, előrendelés → `preorder`, más szöveg aktív kosárgombbal → `available`.
- A termékoldalra mutató „Tovább”/opcióválasztó gomb nem aktív kosárgomb; változatokat nem bontunk szét és nem nyitjuk meg a termékoldalt.
- A pontos „Hamarosan” feliratú, egyetlen közvetlen `a.button.product_type_simple` részletezőgomb `data-product_id` nélkül is elfogadható, ha a saját kártya termékoldalára mutat, query/hash és `add_to_cart_button` osztály nélkül. Megadott ID nem térhet el. A kártya beleszámít a teljességbe, de nem elérhető, még „Előrendelhető” készletszöveg mellett sem. A `post-ID`, kategória, cím és biztonságos terméklink továbbra is kötelező; névből vagy `product_tag-hamarosan` osztályból nem következtetünk erre az állapotra.
- 2026-10-22-én az élő HTML-ben a Prismatic Evolutions Super Premium Collection (`158849`) ilyen „Hamarosan” gombot adott, gomb-ID nélkül; a régi adapter „Hiányos GeekEmpire termékkártya vagy azonosító” hibája ezzel reprodukálható volt. A javítás mellett az aktív kosárgombos előrendelések változatlanul elérhetők maradnak.
- Kivétel a készletszöveg tájékoztató szerepe alól: pontosan egy `.stock` elem pontos „Foglalt” szöveggel nem elérhető terméket jelent. Az ilyen kártya normál kosárgomb és gomb-ID nélkül is beleszámít a lista teljességébe, de kimarad az elérhető kínálatból. A `post-ID`, kategória, cím és biztonságos terméklink továbbra is kötelező; ha van részletező gomb, a saját termékre kell mutatnia, és a megadott ID nem térhet el. Dupla gomb, támadó link vagy ismeretlen állapot továbbra is hibát ad. Terméknévből nem következtetünk foglalásra.
- A 2026-10-20-i élő olvasási próba idején nem volt foglalt termék: 16 elérhető kártya sikeresen feldolgozható volt. A foglalt, gomb nélküli és részletezőgombos változatok szintetikus regressziós tesztek; a korábbi éles kártyahibák és a foglalás közti kapcsolat nem bizonyított rögzített hibás HTML nélkül.
- Ár: akciós `.price ins .woocommerce-Price-amount`, különben utolsó árösszeg; HUF „Ft”, szóközös ezres tagolás. A régi `del` ár nem értesítési ár.
- Kép: `.attachment-woocommerce_thumbnail`, `data-src` elsőbbséggel, saját HTTPS `/wp-content/uploads/` útvonalon.

Jelenleg teljes **egyoldalas** kategória támogatott. Ha valódi lapozás jelenik meg, az adapter hibával megőrzi az előző állapotot; új pagination szerkezetet csak külön ellenőrzés után támogatunk. Kártyaszám-/ID-/kategóriaeltérés, ismeretlen gomb vagy idegen canonical szintén hibát ad.

Önálló 3 perces alapütemezés (3–60 perc), saját csendes baseline, termékállapot, események/beállítások és levélsor. Az e-mail kikapcsolva; későbbi újdonságok a `/pokemon` közös felső listájában is megjelennek. Tesztek: `tests/geekempire.test.ts`; anonim minta: `tests/fixtures/pokemon/geekempire/catalog.html`.

Telepítés: 83/83 teszt, typecheck és build sikeres; UAC után kilépési kód 0. Mindhárom szolgáltatás Running, worker LocalService; mind a nyolc webshop rendben, összesen 191 termék. Régi baseline-ok/beállítások megmaradtak; az új baseline friss HTTP-scanből, nem diagnosztikai importból készült. 0 esemény/levélmunka, SMTP nincs konfigurálva, e-mail kikapcsolva. Anonim oldal/API 307/401 helyben és publikus HTTPS-en; Google-munkamenet hiányában nincs bejelentkezett vizuális ellenőrzés vagy auth-bypass.
