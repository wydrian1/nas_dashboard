# Cardverse — készletes Pokémon TCG

Elemzés és sikeres élesítés: 2026-10-01. Az önálló worker csendes baseline-ja 20 elérhető terméket mentett, képpel és árral; állapot `ok`, e-mail kikapcsolva.

https://www.cardverse.hu/termekkategoria/gyujtogetos-kartyajatekok/?_stock=instock&_cat=gyujtogetos-kartyajatekok&_brand=pokemon-tcg&~1

Robots és megadott szűrőlista HTTP 200. A robots tiltja az `add-to-cart` kéréseket; ezeket soha nem nyitjuk meg. Csak robots és a pontos háromszűrős kategória GET-je engedett, minimum 1500 ms szünettel. Az üres `~1` paraméter az adott Search & Filter lekérdezés jelölése, megőrizzük.

Teljes közvetlen adapterpróba: **20 elérhető termék**, 20 kép és HUF-ár, egy oldalon. A gombok kosárikonok, **`aria-label=Kosárba: …`** hozzáférhető felirattal; nem hiányzó gomb vagy pusztán készletszöveg. Aktív kosárgombos általános szabályt alkalmazunk.

## Search & Filter / WooCommerce kontraktus

Adapter: `lib/pokemon/adapters/cardverse.ts`, `1.0.0`, webshopkulcs `cardverse`.

- `body.tax-product_cat.term-gyujtogetos-kartyajatekok` kategóriamarker. A webshop canonical értéke a főoldal, h1 sincs, ezért ezek nem megbízható kategóriaazonosítók.
- A HTML-be ágyazott **`window.searchAndFilterData = {JSON};`** adatait JSON.parse-szal olvassuk, soha nem eval-lal. Kötelező a pontos három kiválasztott érték: stock=instock, cat=gyujtogetos-kartyajatekok, brand=pokemon-tcg.
- Query 1 aktív WooCommerce/shop, taxonomy archive URL pontos, `currentPage=1`, `maxPages=1`, `foundPosts=20`, `postsPerPage=32` megfigyelt. A teljes kártyaszámnak a `foundPosts` értékkel egyeznie kell. Egy jelen levő load-more konténer önmagában nem jelent további termékeket; a query metaadat igazolja a teljességet.
- Fő grid: `.search-filter-query--id-1 > #product-list.sf-product-list > article.cvx-product.product`. ID: `post-ID`, gomb `data-product_id` és `add-to-cart=ID` egyező, SKU: `data-product_sku`. Minden kártya `meta[itemprop=brand]` értéke „Pokémon TCG”.
- Cím/link: közvetlen `a.main-cta-wrapper`, `.cvx-product-title`, saját HTTPS `/termek/slug/`. Nem szűrünk Pokémon kezdetű címre: például Mega Lucario nevű termék is a validált márkalistához tartozik.
- Aktív `a.cvx-add-to-cart-loop.product_type_simple.add_to_cart_button`, `role=button`, „Kosárba:” aria-label. Gombcél azonosítója és maradék szűrőparaméterei egyezőek; csak szövegként validáljuk, nem kérjük le. Disabled/hidden gomb kizárva; termékoldal/opció gomb nem aktív kosárgomb.
- Ár: `meta[itemprop=price]` csak `priceCurrency=HUF` mellett. Kép: saját WordPress HTTPS `/wp-content/uploads/`, jelenleg tömörített `wc-compressed/product-loop/` képek.

Nem használunk nyilvános nonce-t, REST API-t, JS-es szűrőhidrálást, kosarat vagy termékoldalt. A jelenleg teljes egyoldalas listát támogatjuk; többoldalassá válás/hiányos JSON/szűrő/ID/gomb esetén hiba és korábbi állapot megőrzése. Önálló 3 perces ütemezés (3–60), csendes baseline, e-mail kikapcsolva, saját beállítások/események és közös `/pokemon` lista. Tesztek: `tests/pokemon-new-shops.test.ts`; anonim minta: `tests/fixtures/pokemon/cardverse/catalog.html`.
