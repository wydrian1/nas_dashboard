# RT Collectors Club — Pokémon Boxok/Tinek

Elemzés és sikeres élesítés: 2026-10-01. Az önálló worker csendes baseline-ja 6 elérhető terméket mentett, képpel és árral; állapot `ok`, e-mail kikapcsolva.

Felhasználó linkje:
https://rtcollectorsclub.com/collections/pokemon-dobozok?filter.v.availability=1&filter.v.price.gte=&filter.v.price.lte=&sort_by=best-selling

Worker forrása:
https://rtcollectorsclub.com/collections/pokemon-dobozok?filter.v.availability=1

A robots tiltja a `sort_by` és a több `filter` paraméterrel létrehozott gyűjteménycímeket. **A megadott eredeti címet nem kértük le**; a robots-engedett egyetlen készletszűrős nézet HTTP 200. A böngészős link megmarad, a workernek csak a minimális engedett készletszűrés és `page` lapozás engedélyezett. Nincs cart, JSON API, termékoldal vagy checkout kérés.

## Kifejezett felhasználói kivétel

A lista nem hagyományos „Kosárba” gombot mutat, hanem Shopify bulk mennyiségmezőt +/− gombbal. Ezt külön kérdésben tisztáztuk: a felhasználó **„Készletes lista”** szabályt választott. Ezért a MythGameshez hasonlóan a listán szereplés elérhetőséget jelent; **nincs külön cart-, pluszgomb-, variáns- vagy termékoldal-ellenőrzés**. Nem manipuláljuk a mennyiséget és nem küldünk kosárkérést. A kivétel csak erre a shopra vonatkozik.

Teljes közvetlen adapterpróba: **6 elérhető termék**, 6 kép és HUF-ár, egy oldal. Teljes szűretlen gyűjteményszám 17; a Dawn `ProductCount` fordítása „17/6 termék”, ebből a második érték a szűrt találatszám. Nem mentünk 17 terméket vagy üres listát a fordított formátum miatt.

Adapter: `lib/pokemon/adapters/rtcollectorsclub.ts`, `1.0.0`, webshopkulcs `rtcollectorsclub`.

- Pontos canonical, `h1=Kollekció: Pokémon Boxok/Tinek`, kijelölt availability=1 (desktop/mobile egyaránt); `#ProductCountDesktop/#ProductCount` összegzés egyező.
- Fő lista `ul#product-grid > li`, `.card-wrapper.product-card-wrapper`, `CardLink-*` és `title-*` egyező numerikus **termék-ID**, nem variáns-ID vagy cím.
- Saját HTTPS `/products/slug` link, nyomkövetési paraméterek nélkül.
- Aktuális HUF-ár: akciós `.price-item--sale`, másként `.price__regular .price-item--regular`, ponttal tagolt ezresek. Kép: saját HTTPS `/cdn/shop/` vagy `cdn.shopify.com/s/files/`.
- Előrendelési cím/badge → `preorder`, egyéb listás elérhetőség → `available`.

Lapozás: `page=2` stb., a teljes szűrt darabszám és minden termék-ID egyedisége kötelező; ismételt részoldal, változó darabszám vagy inkomplett grid hibát ad. Max. 600 termék/50 oldal, minimum 1500 ms szünet és robots-ellenőrzés minden kategóriakérés előtt. Önálló 10 perces ütemezés (5–60), csendes baseline, e-mail kikapcsolva, saját események/beállítások/levélsor és közös `/pokemon` lista. Tesztek: `tests/pokemon-new-shops.test.ts`; anonim minta: `tests/fixtures/pokemon/rtcollectorsclub/catalog.html`.
