# Pöttyös Zebra — Pokémon TCG

Elemzés és teljes HTTP-adapterpróba: 2026-10-01. A Windows figyelőgépről robots.txt és kategória HTTP 200. **23 termék, 2 oldal, 23 kép és forintár**, az első oldalon 12, a másodikon 11 termék.

**Élesítési állapot: aktiválva.** 58/58 teszt, típusellenőrzés és staging production build sikeres. Az első UAC-kérés megszakadt; a felhasználó külön kérésére újraindított jóváhagyás után a dashboard és az immutable worker-release telepítése sikeres (kilépési kód 0). A külön `/pokemon` oldal, az aggregált nézet és a Pöttyös Zebra automatikus figyelése éles.

## Forrás és elérhetőség

https://pottyoszebra.hu/gyujtogetos-kartyajatekok-tcg/pokemon-trading-card-game-tcg?stockfilter=1

Shoprenter szerveroldali HTML, saját Budapest-sablonnal. A robots.txt általános csoportja `Allow: /`, MJ12bot számára külön tiltással; a WydrianMonitor kategória- és lapozott lekérései engedettek. A worker minden oldalon ellenőrzi a robots-szabályokat, legalább 1500 ms szünettel. Nincs bejelentkezés, böngészőautomatizálás vagy botvédelem-megkerülés.

Elérhető = **aktív „Kosárba” gomb**, a korábban megadott általános szabály szerint; a készletszöveg tájékoztató. A próbában 22 „Raktáron” és egy eltérő („Elfogyott”) készletszövegű, de aktív kosárgombos termék szerepelt. Ez utóbbi `available`, nem `in_stock`; nem írjuk felül az aktív gomb alapján megállapított elérhetőséget. Előrendelés aktív gomb mellett szintén elérhető, külön címkével. A MythGames listatagsági kivétele változatlan.

## Adapterkontraktus

- Adapter: `lib/pokemon/adapters/pottyoszebra.ts`, verzió `1.0.0`, webshopkulcs `pottyoszebra`.
- Kötelező `body.category-list-body`, Pokémon-fejléc és kijelölt `#stockfilter-checkbox`.
- Kanonikus link: pontos kategóriadomain/útvonal; lapozva `?page=2`. Az oldalszámnak egyeznie kell a lekért oldallal.
- Lapozási összegzés: `.pagination__results`, pl. `1 - 12 / 23 termék`. A felső és alsó számlálónak egyeznie kell.
- Lista: `.product-list > .product-snapshot-vertical > .product-snapshot`.
- Stabil numerikus ID: `input[name="product_id"]`; aktív kosárgomb `data-product-id` értékével egyező. SKU: `data-product-sku`.
- Cím/link: `.product-card__title a`. Csak a webshop HTTPS terméklinkje engedett; követési paraméterek és fragment eltávolítva. **A kosárgomb `index.php?route=checkout/cart...` URL-je nem terméklink, soha nem kérjük le.**
- Elérhetőség: `.button-add-to-cart`, nem disabled/aria-disabled, „Kosárba” szöveg. Raktár-/előrendelési szöveg: `.product-card__stock`.
- Ár: aktív gomb `data-price-without-currency`, csak `data-currency="HUF"` mellett; hiányzó/hibás ár `null`.
- Kép: `.product-card-image img[src]`, kizárólag `https://pottyoszebra.cdn.shoprenter.hu`.

## Lapozás és biztonság

A webshop saját lapozólinkjei **nem tartalmazzák a `stockfilter=1` paramétert**. Nem követjük ezeket változtatás nélkül: a figyelő minden kategóriaoldal URL-jét a rögzített készletszűrt alapcímből állítja össze `page=2` stb. paraméterrel, és minden válaszon újra ellenőrzi a filter kijelölését.

Teljes kategóriaszám, folytonos start/end tartományok, tényleges kártyaszám és egyedi termék-ID-k kötelezőek. Változó teljes szám, rossz oldal/filter, hiányos/duplikált kártyák vagy elfogyó korlát esetén nincs állapotfrissítés. Legfeljebb 50 kategóriaoldal, 600 termék, 20 s/lekérés, 3 MiB/HTML, 3 perc/teljes workerscan. Letöltés: rögzített domain/útvonal/szűrő és nyilvános DNS-cím, címrögzítéssel; átirányítás csak azonos originre. Termékoldalak, kosár- és checkout-végpontok nem szerepelnek a lekérési engedélylistán.

Önálló ütemezés, baseline és események; tízperces alapgyakoriság (5–60 percre állítható). Az első teljes scan értesítés nélküli alapállapot. A GameRunner/MythGames adatait nem módosítja. E-mail alapból kikapcsolva; közös eltűnés-/listacsökkenés-védelem és tartós outbox.

Tesztek: `tests/pottyoszebra.test.ts`, anonim szerkezeti minta: `tests/fixtures/pokemon/pottyoszebra/available.html`. Külön ellenőrzik a szűrő megőrzését lapozáskor, a lapozott kanonikus linket, az aktív kosárgomb elsőbbségét és az önálló baseline/levélkezelést.

## Éles ellenőrzés

- Mindhárom Windows-szolgáltatás Running; a worker továbbra is LocalService.
- Pöttyös Zebra első workerscan: baseline, 23 termék, 2 oldal, 23 kép; `status=ok`, hiba nincs.
- GameRunner 12, MythGames 15 termék; korábbi baseline-ok és beállítások a telepítés előtti feljegyzéssel egyeznek.
- Mindhárom e-mail-kapcsoló kikapcsolva; baseline után 0 esemény, 0 levélmunka. Az aggregált nézet ezért kezdetben helyesen üres, nem tünteti fel újdonságként a baseline-termékeket.
- Anonim `/pokemon`: 307 átirányítás a belépőoldalra; anonim `/api/pokemon`: 401.
- A korábbi böngészős Google-munkamenet lejárt: az új oldal élő, bejelentkezett vizuális ellenőrzéséhez új belépés szükséges. Hitelesítési bypass-t nem használtunk.
