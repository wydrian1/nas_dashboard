# Reflexshop — „pokemon tcg” készletszűrt keresés

Elemzés és élesítés: 2026-10-01. **Élesítve**, a JátékNet és GeekEmpire bővítésével együtt. Friss worker-baseline: 9 termék/1 oldal, 9 kép/ár, `status=ok`, hiba nélkül.

Felhasználó és worker címe:
https://reflexshop.hu/shop_search.php?search=pokemon+tcg&filter=product_status:in_stock

Robots.txt és keresés HTTP 200. Általános robots-szabály: csak `/shop_ajax/*` tiltott. A figyelő csak robots.txt és a megadott szerveroldali keresőlista GET-jét használja, legalább 1500 ms szünettel. A tiltott AJAX-végpontokat nem kéri le, JS-t nem futtat, kosarat nem módosít.

Teljes közvetlen adapterpróba: **9 elérhető termék egy oldalon, 9 kép és 9 HUF-ár**. Hat Pokémon TCG termék mellett három általános kártyavédő is találat; a felhasználó megadott nézetét követjük, nem szűkítjük önkényesen a címet vagy márkát. Ez a felületen is szerepel.

## UNAS-kontraktus

Adapter: `lib/pokemon/adapters/reflexshop.ts`, verzió `1.0.0`, webshopkulcs `reflexshop`.

- `#page_search_content.search-result-page-content`, `h1=KERESÉS:pokemon tcg`, a `#param_product_status_content` pontosan `in_stock` kijelölt státusza kötelező.
- Teljes darabszám: **`.counter-row [data-purpose=base-product-counter]`**. A mobilgombban ismételt számláló és az üres szűrőgomb-placeholder nem termékszám; nem vonjuk őket össze.
- Csak `#page_artlist_content [data-purpose=product-list] > article.product-card` találatok.
- Stabil termékazonosító/SKU: `a.name-link[data-sku]`. A kártya `page_artlist_artlist_*` azonosítójában `-` → `__unas__` kódolás, a mennyiségmező neve és a cart action ugyanezt az SKU-t használja.
- Aktív kosárgomb: `a.cart-button`, `role=button`, `aria-label=Kosárba teszem`. Az élő lista `href=javascript:void(0)` és `onclick=cart_add('SKU__unas__…','artlist_');` attribútumát **csak szövegként validáljuk**, nem értelmezzük/végrehajtjuk. A mentett link kizárólag a saját domain HTTPS-termékoldala. Disabled/hidden gomb kizárva; készletszöveg tájékoztató.
- Ár: `.sale-price`, „Ft”, ponttal tagolt ezresek. Kép: `img.main-image[data-src]`, saját HTTPS `/img/` útvonal; `main_pic/space.gif` nem valódi kép.

A jelenleg igazolt, teljes **egyoldalas** nézet támogatott. A számlálóval egyező teljes kártyaszám és egyedi SKU-k kötelezők. Ha lapozás/részleges lista jelenik meg, hibát jelzünk és megőrizzük a korábbi állapotot; nem írunk át készletet az első oldal alapján és nem találunk ki lapozóparamétert. Hibás keresés/szűrés/gomb/azonosító szintén nem ad teljes eredményt.

Önálló 3 perces alapütemezés (3–60 perc), saját baseline/beállítások/események és e-mail-sor. Csendes első baseline, e-mail alapból kikapcsolva, közös felső eseménylista a `/pokemon` oldalon. Tesztek: `tests/jateknet-reflexshop.test.ts`; anonim minta: `tests/fixtures/pokemon/reflexshop/search.html`.

Telepítés: 83/83 teszt, typecheck és build sikeres; UAC után kilépési kód 0. Nyolc webshop rendben, 191 elérhető termék; régi baseline-ok/beállítások megmaradtak. Minden szolgáltatás Running, worker LocalService. 0 baseline-esemény/levélmunka, SMTP konfigurálatlan, e-mail kikapcsolva. A privát oldal/API anoniman 307/401 választ ad helyben és publikus HTTPS-en. Friss Google-belépés hiányában bejelentkezett vizuális ellenőrzést nem állítunk.
