# JátékNet — gyűjthető Pokémon-kártyák

Elemzés és élesítés: 2026-10-01. **Élesítve**, a Reflexshop és GeekEmpire bővítésével együtt. Friss worker-baseline: 11 termék/1 oldal, 11 kép/ár, `status=ok`, hiba nélkül.

- Felhasználó böngészős linkje: https://www.jateknet.hu/gyujtheto-kartya?f=hid_165
- Worker forrása: https://www.jateknet.hu/gyujtheto-kartya
- A robots.txt `/*?f=` és `/*&f=` szabálya tiltja a szűrős címet: ezt **nem kértük le**, a fetch-engedélylista is kizárja. Az engedett szűretlen kategória HTTP 200.
- Robots `Crawl-delay: 1`; a worker legalább 1500 ms szünetet tart. Nincs böngésző, AJAX-, kosár-, termékoldal- vagy alternatív szűrőlekérés.

## Igazolt teljes kínálat

24 kategóriakártya egyetlen oldalon, ebből 11 Pokémon nevű, aktív „Kosárba” gombbal. A helyi címválasztás darabszáma megegyezik a nyilvános kategória `hid_165` Pokémon-számlálójával (11); e hivatkozásnak csak a szövegét olvassuk, nem nyitjuk meg. A teljes közvetlen adapterpróba **11 elérhető terméket, 11 képet és 11 HUF-árat** adott.

## Kontraktus és biztonság

Adapter: `lib/pokemon/adapters/jateknet.ts`, verzió `1.0.0`, webshopkulcs `jateknet`.

- Kötelező `.page-search[data-gtm-list="Category - Gyűjthető kártya"]`, a találati oszlop első „Gyűjthető kártya” h1-je, egyező teljes darabszámok `.search-browse-num span` alatt.
- Csak a találati oszlop `.products-list > .product-box` kártyái; fejlécben/akciós ajánlóban ismételt termékek kizárva.
- Pokémon = ékezet és kis-/nagybetű nélkül `Pokemon` kezdetű cím. A teljes kártyaszám és a Pokémon-számlálóval egyező címválasztás kötelező; eltérésnél nincs állapotfrissítés.
- Stabil ID: `data-pid`, egyező `input[name=product_id]` és a termék-URL végső numerikus azonosítója. SKU: a kártya `data-gtm` JSON-jában `manufacturer_code`, ID-egyezéssel.
- Elérhető = aktív `button.add-to-cart.addShoppingCart`, „Kosárba” szöveggel. Disabled/hidden gomb nem rendelhető; készletszöveg tájékoztató. A gombot nem nyomjuk meg. Előrendelési badge opcionálisan `preorder`, egyébként `available`.
- Ár: `.product-box-price .price-row.price`, HUF „Ft” és szóközös ezres tagolás. `data-unit-netto` **nem** végső bruttó árforrás.
- Kép: `.product-image img[data-src]`, valódi `https://netjatek.hu/images/common/products/…` CDN; a `src` noimage placeholderét nem mentjük.

A jelenleg igazolt, teljes **egyoldalas** nézet támogatott. A kártyaszámnak a teljes kategóriaszámmal egyeznie kell; a lapozóban csak „1. oldal” lehet. Ha a kínálat többoldalassá válik vagy a Pokémon-számláló eltűnik/megváltozik, a scan hibával megőrzi az előző állapotot, nem tekinti az első oldalt teljesnek. Lapozási támogatás csak a valós, robots-engedett szerkezet későbbi külön validálásával bővíthető; nincs kitalált `?page=` kérés.

Önálló 10 perces alapütemezés, 5–60 perces beállítás, saját baseline, változások és levélkimeneti sor. Első baseline csendes; e-mail kikapcsolva. Újdonságok a `/pokemon` közös felső listájában is megjelennek. Tesztek: `tests/jateknet-reflexshop.test.ts`; anonim minta: `tests/fixtures/pokemon/jateknet/catalog.html`.

Telepítés: 83/83 teszt, typecheck és production build sikeres; UAC-jóváhagyás után telepítési kilépési kód 0. Mindhárom szolgáltatás Running, worker LocalService. Mind a nyolc webshop rendben, összesen 191 elérhető termék; korábbi öt baseline és beállítás megmaradt. A baseline-ok csendesek: 0 esemény/levélmunka, SMTP nincs konfigurálva, minden e-mail-kapcsoló kikapcsolva. Anonim `/pokemon` 307 és `/api/pokemon` 401, lokálisan és publikus HTTPS-en is. A bejelentkezett vizuális ellenőrzéshez új Google-munkamenet kell; auth-bypass-t nem használtunk.
