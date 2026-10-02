# TCG Futár — Pokémon TCG

Elemzés és sikeres élesítés: 2026-10-01. Az önálló worker csendes baseline-ja 1 elérhető terméket mentett, képpel és árral; állapot `ok`, e-mail kikapcsolva.

- Felhasználó linkje: https://tcgfutar.hu/spl/100003/Pokemon-TCG?infinite_page=4
- Worker első kérése: https://tcgfutar.hu/spl/100003/Pokemon-TCG
- Robots és kategória HTTP 200; `/shop_ajax/*` tiltott, a sima HTML és `infinite_page` nézet engedett. Minimum 1500 ms lekérési szünet.
- Teljes közvetlen adapterpróba: **16 kártya, 1 elérhető termék**, képpel és HUF-árral, 2 kategórialekérés.

## Elérhetőség és teljes betöltés

A felhasználó külön kiemelte: **a „Kosárba” gomb jelenléte számít**. Csak aktív `button.product__cart-btn`, „Kosárba” szöveg, `type=button`, egyező `cart_add('SKU','artlist_');` attribútum és mennyiségmező mellett elérhető. A 15 nem rendelhető kártya kosárgomb nélkül `.not-stock__text=Nincs raktáron` területet ad; ezeket kizárjuk. A készletszöveg önmagában nem igazol rendelhetőséget. A gombot nem nyomjuk meg és JS-t nem futtatunk.

A lista **kumulatív**, nem egymástól különálló részoldalakból áll: alapnézet 12 kártya, `infinite_page=2` már mind a 16, a megadott `infinite_page=4` ugyanezt a teljes 16-ot tartalmazza. A worker az elsőtől indul, növeli az `infinite_page` paramétert és csak az igazolt teljes darabszám elérésekor ment. A korábbi kártyák ID-sorrendje változatlan prefix kell legyen; az ismételt előtagot nem hozzáfűzi, hanem a teljes kumulatív eredménnyel cseréli. Nincs 4× vagy 12+16 darabos téves lista. Részleges nézetben a `var infinite_scroll_num=N;` jelzés kötelező; teljes nézetből a webshop elhagyja ezt a scriptet.

## Statikus kontraktus

Adapter: `lib/pokemon/adapters/tcgfutar.ts`, `1.0.0`; közös, új UNAS-parser: `unas-category.ts`; teljes letöltési ellenőrzés: `catalog-scan.ts`. A korábbi adapterek nem változtak.

Pontos canonical és első h1 (`Pokémon TCG`), egyező `.paging-sorting-ordering .product-num` összegzések, `.page_artlist_list.products > article.product`. Stabil ID/SKU: `data-sku`, kártyaazonosítóban a `-` karakter `__unas__` kódolású, terméklink `data-sku`, cart action és mennyiségmező egyező. A cím nem azonosító. Saját HTTPS-terméklink lehet `/spd/SKU/slug` vagy natív `/slug`; mindkét valós formát támogatjuk.

HUF-ár: akciós `.product__price-sale`, különben `.product__price-base`, nem egységár. Kép: saját HTTPS `/img/` `img.js-main-img[data-src]`, nem `space.gif`. Állapot: aktív gomb + Raktáron (N db) → `in_stock`, előrendelés → `preorder`, más szöveg aktív gombbal → `available`.

Csak robots és a pontos kategória GET-je (`infinite_page=1..50`) kérhető le; nincs AJAX-, termékoldal-, cart- vagy bejelentkezési kérés. Max. 600 kártya/50 nézet, közös 20 s/kérés, 3 MiB/HTML, 3 perc/workerscan. Eltérő teljes darabszám, nem növekvő/ismételt kumulatív lista, duplikált SKU, hibás gomb vagy szűrő: a korábbi állapot megmarad.

Önálló 10 perces ütemezés (5–60 perc), csendes első baseline és saját beállítások/események/levélsor. E-mail kikapcsolva. Közös `/pokemon` felső eseménylista. Tesztek: `tests/pokemon-new-shops.test.ts`, anonim minta: `tests/fixtures/pokemon/tcgfutar/catalog.html`.
