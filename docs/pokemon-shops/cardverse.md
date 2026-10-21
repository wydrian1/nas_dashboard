# Cardverse — készletes Pokémon TCG

Forrás: **https://www.cardverse.hu/termekkategoria/gyujtogetos-kartyajatekok/?_stock=instock&_brands=pokemon-tcg**

## FacetWP / WooCommerce kontraktus (adapter 2.0.0)

- A webshop 2026-10-es átalakítása lecserélte a Search & Filter rendszert és a termékkártyákat. A régi `_brand`, `_cat`, `~1` paraméterek már nem igazolják a Pokémon-szűrést. A régi, pontosan ismert URL célzott adatbázis-migrációt kap; baseline, készlet, értesítési beállítások és vizsgálati ütemezés változatlanok.
- Csak publikus HTTPS GET: robots.txt és a pontos kategória `_stock=instock`, `_brands=pokemon-tcg` paraméterekkel, szükség esetén `_paged=2..50`. Nincs kosárkérés, login, cookie, JavaScript-futtatás, FacetWP AJAX/REST API vagy nonce-használat. A meglévő DNS-pinning, méret-/időkorlát és robots-ellenőrzés megmarad, kérések között legalább 1500 ms szünettel.
- A kategóriát a body taxonómia és a pontos canonical igazolja. A `window.FWP_HTTP` és `window.FWP_JSON` kizárólag önálló JSON-értékadásként olvasható, soha nem `eval`-lal. A kérésmetaadat, az aktív szűrőértékek és a preload két bejelölt facetje egyaránt kötelező.
- A pager egész oldalszámot, oldalméretet, találatszámot és konzisztens oldalszámösszesítőt ad. Minden oldalon a `.products-container > #product-list-wrapper.facetwp-template > ul.products` közvetlen `article.cverse-product` kártyáinak száma pontosan egyezzen a várt oldalmérettel. Változó összesítés, ismételt oldal/ID, hiányzó vagy hibás metaadat esetén a vizsgálat hibázik, nem ír részleges készletet.
- A stabil külső ID a közvetlen `.loop-add-to-cart` gomb `data-product_id` mezője, a SKU külön opcionális adat. A Pokémon márka strukturált jelölése, terméknév, biztonságos saját `/termek/…/` link, aktív egyszerű kosárgomb, hozzáférhető `Kosárba:` felirat és egyező `add-to-cart` cél kötelező. A kosár-URL-t csak ellenőrizzük, soha nem kérjük le.
- Elérhető eredményhez `stock-is-instock`, `Raktáron` felirat és schema.org `InStock` bizonyíték kell; az elérhetőség `in_stock`. Előrendelést nem következtetünk névből, és ismeretlen készletjelölést nem fogadunk el. Letiltott/variánsválasztó kártya csak a teljességi számlálásba kerül. Kép és HUF-ár opcionális.

## Ellenőrzés

A sanitizált fixture és regressziós tesztek lefedik az új kártyákat, mindkét JSON-forrást, a hibás/hiányzó szűrést, idegen márkát, készletellentmondást, hiányos/ismételt/változó lapozást, kosárcélt és az állapotmegőrző URL-migrációt. Élő felderítéskor az új szűrés **14 készletes Pokémon-terméket** adott egy oldalon; a régi URL más márkákat is tartalmazott.

A forrásmódosítás nem jelent élesítést; a következő workerindításkor lefutó migráció nem törli a korábbi baseline-t.
