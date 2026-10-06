# MythGames — Pokémon készletszűrt kategória

Elemzés és első teljes adapterpróba: 2026-10-01. Forrás: szerveroldali Shopify HTML, közvetlenül a Windows háttérfigyelő gépéről is HTTP 200. A próba 15 terméket adott, egy kategóriaoldalon; mindegyikhez kép és forintár is kiolvasható.

## Elérhetőségi szabály

**A felhasználó kifejezett döntése: ami a `filter.v.availability=1` listában szerepel, az elérhető.** Nem ellenőrzünk kosárgombot, nem kérünk le külön termékoldalakat, és nem bontjuk fel variánsokra a termékeket. A címben/kártyacímkében látható előrendelés csak besorolás, nem kizárás. A GameRunner aktív kosárgombos szabálya változatlan.

Megadott URL:

https://mythgames.eu/collections/pokemon-kartyak-booster-boxok-es-gyujtoi-termekek?sort_by=created-descending&filter.v.availability=1

Automatikus lekérés:

https://mythgames.eu/collections/pokemon-kartyak-booster-boxok-es-gyujtoi-termekek?filter.v.availability=1

A robots.txt tiltja a `sort_by` paraméteres kategóriacímeket. A rendezést elhagyjuk, a készletszűrő változatlan; az összehasonlítás sorrendtől független. A robots.txt az egyetlen készletszűrős URL-t engedi. Minden lekért kategóriaoldal útvonalát és paramétereit ellenőrizzük a robots-szabályokkal, legalább 1500 ms szünettel. Ez technikai crawl-engedély, nem általános jogi felhasználási engedély.

## Feldolgozási szerződés

- Adapter: `lib/pokemon/adapters/mythgames.ts`, verzió `1.0.0`.
- Kategória: kizárólag `/collections/pokemon-kartyak-booster-boxok-es-gyujtoi-termekek`.
- Kötelező kanonikus kategória-URL és kijelölt `input[name="filter.v.availability"][value="1"][checked]`.
- Teljes termékszám: `.hdt-active-filters__count > span`.
- Fő terméklista: `hdt-reval-items.hdt-collection-products[id^="products-"]`, közvetlen `hdt-card-product` gyermekek. A menü ajánlókarusszeljeinek szintén van `hdt-collection-products` osztályuk, ezért ezeket nem szabad a készletes listához keverni.
- Cím és link: `a.hdt-card-product__title`. A kategóriás terméklinket `/products/<handle>` alakra normalizáljuk, a követési paramétereket eltávolítjuk.
- Termékszintű kulcs: a kanonikus link `<handle>` része, nem a cím. SKU-t vagy numerikus Shopify-ID-t nem találunk ki. A handle webshop általi megváltoztatása új terméknek látszhat; nincs variánsszintű készletértesítés.
- Kép: `img.hdt-card-product__media--main`, HTTPS webshop/CDN cím, közvetlen böngészős betöltéssel. Nincs képletöltés a workerben.
- Ár: `hdt-price .hdt-money`, csak felismerhető `Ft` értékből; hiányzó vagy idegen pénznemű ár `null`, nem hiba.
- Listatagság = `available`; explicit előrendelési cím/címke esetén `preorder`, továbbra is elérhető.

## Teljesség és védelem

Csak kategóriaoldalak és naponta gyorsítótárazott robots.txt. Lapozás `page=2`, `page=3` stb.; a teljes számlálóig, stabil teljes termékszámmal és egyedi kulcsokkal. A jelenlegi élő egyoldalas listát igazoltuk; a többoldalas esetet tesztminták ellenőrzik, élő többoldalas kínálat most nincs.

Korlátok: 600 termék, 50 kategóriaoldal, a közös letöltőben 20 másodperc/lekérés és 3 MiB/oldal, a workerben 3 perc/teljes vizsgálat. Hibás/hiányos/ismétlődő HTML, nem egyező szám vagy tiltott cím esetén nincs állapotfrissítés. Nincs kosár-, checkout-, login- vagy böngészőautomatizálás.

## Motor és üzemeltetés

Webshopazonosító: `mythgames`. Saját baseline, termékállapot, események, scan-lease, ütemezés és beállítások; GameRunner-adatok nem cserélődnek le. Az első teljes vizsgálat csendes baseline, háromperces alapgyakorisággal, 3–60 percre állíthatóan. Eltűnés két teljes sikeres vizsgálat után; 50%-nál nagyobb listacsökkenés újabb azonos eredményre vár. Az e-mail alapból kikapcsolva marad.

A közös worker egymás után kezeli az esedékes webshopokat, webshoponkénti hibakezeléssel. A dashboard minden webshophoz külön kártyát és hitelesített beállítási/kézi ütemezési műveleteket ad. A beállításmentés csak az érintett webshop még várakozó termékleveleit törli, nem más webshop leveleit és nem folyamatban lévő küldést. Az outbox a levél payloadjában tárolt webshop beállításait ellenőrzi; a levél tárgya/szövege is a megfelelő webshop nevét kapja.

Tesztek: `tests/mythgames.test.ts`, anonimizált struktúra: `tests/fixtures/pokemon/mythgames/available.html`. Ellenőrzik a listaalapú szabályt kosárgomb nélkül és tiltott gomb mellett is, a menütermékek kizárását, árakat/linkeket, lapozást, robots-tiltást, a termékoldallekérések hiányát, külön baseline-okat/lease-eket és a webshoponkénti levélkezelést.

## Élesítés ellenőrzése — 2026-10-01

- 50/50 teszt, típusellenőrzés és staging production build sikeres; UAC-jóváhagyással a dashboard és az immutable worker-release aktiválva.
- `WydrianPokemon` Running, LocalService; dashboard és HTTPS továbbra is Running, meglévő LocalSystem fiókkal.
- MythGames első éles scan: `baseline`, 15 termék, 1 oldal, 15 mentett képcím; tízperces figyelés aktív, e-mail kikapcsolva. Nincs baseline-riasztás, esemény vagy levélmunka.
- GameRunner 12 terméke és korábbi baseline-ja megmaradt.
- Bejelentkezett böngészőben mindkét webshopkártya és saját `shopID` mező látható, külön szabályszöveggel; `/api/pokemon` HTTP 200, mindkét forrás `ok`, nincs felületi hiba. Az első négy MythGames-kép betöltését is ellenőriztük.
- Anonim `/api/pokemon`: HTTP 401.
