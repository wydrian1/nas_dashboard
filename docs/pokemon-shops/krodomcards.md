# Krodom Cards — Pokémon szűrés

Elemzés: 2026-10-01. Megadott nyilvános Shoprenter szűrőnézet:

https://www.krodomcards.hu/index.php?route=filter&filter=category|284/manufacturer|80

Robots.txt és lista a Windows figyelőgépről HTTP 200. A robots általános csoportja `Allow: /`, MJ12bot számára külön tiltással. A megadott GET-szűrés és lapozása a WydrianMonitor számára engedett.

Állapot: **élesítve**, a GrandLine bővítésével együtt. **242 kategóriakártya, 11 oldal, 70 elérhető termék**, mindegyikhez kép és forintár. Az adapter 64-et raktári jelzésűként, 6-ot más készletszövegű, de aktív kosárgombosként sorolt be. Az első éles worker-baseline friss, teljes HTTP-vizsgálatból elkészült: 70 termék/11 oldal, `status=ok`, hiba nélkül. A diagnosztikai mentéseket nem importáltuk baseline-ként a futó adatbázisba.

## Szűrés és elérhetőség

- Kategória: `284`, „Összes termékek” (`category_id=284`).
- Gyártó/brand szűrő: `80`, „Pokémon” (kijelölt `system_manufacturer[]` input).
- A megadott nézet nem készletszűrt. Tartalmaz elérhető és elfogyott termékeket, továbbá például Pokémon figurákat és játékszőnyegeket is. A kérést nem szűkítjük önkényesen csak booster/ETB termékekre.
- **Elérhető = aktív „Kosárba” gomb**, a korábban megadott általános szabály szerint. A készletszöveg tájékoztató; előrendelés aktív gombbal szintén elérhető.
- Fontos: az elfogyott termék **„Értesítés” gombja is `button-add-to-cart` osztályú**. Ez nem kosárgomb: `notify-request` osztály és `waitinglist/waitinglist` cél jelöli. Nem tekintjük elérhetőnek, nem nyitjuk meg és nem iratkozunk fel.
- Egyes elfogyott termékeknél kosár-/értesítési terület nélkül csak a termékoldalra mutató „Részletek” link van (például ID 751). Ezek nem elérhetők. Meglévő kosárterületből hiányzó vagy átnevezett gomb viszont feldolgozási hibát ad, nem csendes készlethiányt.
- A valódi kosárgomb szövege „Kosárba”, céljának `route` értéke `checkout/cart`, `product_id` értéke a kártya ID-jével egyezik. Ezeket csak HTML-ből olvassuk, a kosárlinket nem kérjük le.

## Adapterkontraktus

Adapter: `lib/pokemon/adapters/krodomcards.ts`, verzió `1.0.0`, webshopkulcs `krodomcards`.

Kötelező `body.filter-list-body`, „Termékek szűrése” fejléc, pontosan a 80-as kijelölt gyártó és 284-es kategóriamarker. Kanonikus link nincs; az aktuális lapozólinkek `aria-current="page"` értéke, oldalszáma és dekódolt `route=filter`, `filter=category|284/manufacturer|80` paraméterei igazolják az oldalt. A felső és alsó `.pagination__results` összegzésnek egyeznie kell.

- Fő lista: `#product-list.product-list > .product-snapshot-vertical > .product-snapshot`.
- Stabil ID: `input[name="product_id"]`, gomb `data-product-id` értékével egyező. SKU: `data-product-sku`; a cím nem azonosító.
- Cím és terméklink: `.product-card__title a`, a webshop HTTPS címén, követési paraméterek/fragment nélkül.
- A termék-URL slugja aláhúzást is tartalmazhat; élő példa: `/pokemon-kanto-power-mini-tin-charizard_`. Ezt a saját HTTPS originen engedjük, nem általános tetszőleges útvonalakat.
- Ár: `data-price-without-currency`, csak HUF mellett, opcionális (`null`, ha hibás/idegen pénznem).
- Kép: `.product-card-image img[src]`. A tényleges webshop-CDN régi neve **`pokedom.cdn.shoprenter.hu`**; csak ezt a HTTPS origint engedjük képként, nem találunk ki `krodomcards.cdn…` címet.
- Készletszöveg: `.product-card__stock-label`; Raktáron / Utolsó N db raktáron → `in_stock`, előrendelési jelzés → `preorder`, más felirat aktív kosárgombbal → `available`.

## Teljesség és korlátok

Csak robots.txt és a pontos szűrőlista GET URL-je kérhető le. Mindkét szűrő paramétere minden lapozott kérésben megmarad, `page=2` stb. formában. A percent-encoded `|` és `/` ugyanazt a dekódolt szűrőértéket jelenti; tetszőleges más route/filter, extra paraméter, ismételt paraméter vagy külső origin nem engedett.

Minden kategóriakártya ID-ját számoljuk és deduplikáljuk, beleértve a várólistás/elfogyott kártyákat. Folytonos tartományok, stabil teljes termékszám és a végső teljes kártyaszám kötelező. Nem teljes scan nem írja felül a korábbi állapotot. Limit: 600 kártya, 50 oldal, 20 s/kérés, 3 MiB/HTML, 3 perc/workerscan; oldalanként legalább 1500 ms szünet és robots-ellenőrzés.

Önálló háromperces ütemezés (3–60 percre állítható), baseline, termék-/eseményállapot, lease/backoff és értesítési beállítások. A baseline csendes; e-mail alapból kikapcsolva. Későbbi új elérhetőségek a `/pokemon` összes webshopot összesítő felső listáján is megjelennek. A GrandLine és a régi webshopok baseline-ját nem cseréljük le.

Tesztek: `tests/krodomcards.test.ts`, anonim minta: `tests/fixtures/pokemon/krodomcards/catalog.html`. Külön regresszió: az „Értesítés” ál-kosárgombot kizárjuk azonos CSS-osztály mellett is; cart/waiting-list linket soha nem kérünk le; szűrők és oldalszámok validálása; teljes egyedi katalógus; saját baseline/aggregált esemény/levélnév; webshoponkénti levéltörlés.

Élesítés: 70/70 teszt, typecheck és production build sikeres, UAC után telepítés kilépési kódja 0. Öt webshop önálló működése és csendes új baseline-jai ellenőrizve; a korábbi három baseline és beállítás változatlan. Összesen 157 elérhető termék; minden e-mail-kapcsoló kikapcsolva, 0 esemény/levélmunka. A worker él és LocalService alatt fut; dashboard/HTTPS Running. A `/pokemon` és `/api/pokemon` továbbra is Google-belépéssel védett (anonim 307/401). A bejelentkezett vizuális ellenőrzéshez új Google-munkamenet kell, hitelesítési bypass-t nem használtunk.
