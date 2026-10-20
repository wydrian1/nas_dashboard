# Szerepkörök és személyes Pokémon-értesítések

## Jogosultságok

| Funkció | admin | pokemon-reader |
| --- | --- | --- |
| Induló oldal | `/` | `/pokemon` |
| Szolgáltatások, gyorslinkek, időjárás, gépállapot | Teljes | Tiltva |
| Hírolvasó, RSS-beállítások | Teljes | Tiltva |
| Jegyzetek/teendők | Teljes | Tiltva |
| Pokémon-lista, webshopok, termékek, előzmények, szűrők | Teljes | Ugyanaz az adat |
| Közös figyelés be/ki, gyakoriság, kézi vizsgálat | Módosítható | Csak olvasható állapot; nincs kézi scan |
| Saját webshoponkénti értesítés | Be/ki + eseménytípusok | Csak saját be/ki; minden eseménytípus |
| APK-letöltés (`/mobile/download`) | Engedélyezett | Engedélyezett, a Pokémon-oldalról |
| Saját telefon párosítása (`/mobile/connect`), native token/session/test/revoke | Engedélyezett | Engedélyezett |
| Eszközlista, más telefonjának visszavonása (`/config#mobile`; `/mobile` ide irányít) | Összes fiók | Tiltva, saját lista sem látható |
| Felhasználó/szerepkör-kezelés (`/config#users`) | Engedélyezett | Tiltva |

Az oldalsáv elrejtése nem a védelem: az admin-oldalak a readert `/pokemon`-ra irányítják **az adatok lekérése előtt**, az admin API-k 403-at adnak, minden admin Server Action önálló `requireAdmin()` ellenőrzést végez. Anonim/letiltott/ismert szerepkör nélküli fiók védett API-n 401-et kap. A publikus Google auth/pairing-start útvonalak csak a belépés/párosítás szükséges kivételei, nem adnak önmagukban hozzáférést.

## Csak NULLPONT-játékos (`nullpont-player`)

Ez a szerepkör kizárólag a játékhoz ad hozzáférést, a dashboard egyetlen oldalához sem. Belépés után a `/` azonnal a `/adventure` átadásra irányít, amely a beállított NULLPONT-címre továbbít. Nincs Pokémon, Fontos infók, keresés, pénzügy, fájl, jegyzet, konfig vagy OpenCode, és a fiók nem párosíthat telefont, nem iratkozhat fel böngészős pushra, illetve nem kap modulértesítést. A játék saját `players` táblája továbbra is külön tilthatja a fiókot; a dashboard szerepköre az azonosítás forrása. A NULLPONT belépéshez a dashboard `/api/nullpont/authorize` végpontja csak bejelentkezett, aktív fiókot kér, ezért a szerepkör a játékba beengedi a felhasználót.

## Fiók hozzáadása

1. Tulajdonosként/admin szerepkörrel nyisd meg a Konfig / Felhasználók részt.
2. Add meg a másik felhasználó Google-fiókjának e-mail-címét, válassz `pokemon-reader`, `info-reader`, `nullpont-player` vagy `admin` szerepkört, hagyd bekapcsolva a hozzáférést.
3. A felhasználó saját, igazolt Google-fiókjával jelentkezik be. Nincs nyílt regisztráció: ismeretlen Google-fiók nem kap alapból reader szerepkört.
4. Ha a Google OAuth-kliens hozzájárulási képernyője még **Testing** állapotú, a Google Cloud Console tesztfelhasználói közé is fel kell venni az érintett e-mailt. A dashboard szerepköre nem írja felül a Google szolgáltatói korlátozását.
5. Reader a Pokémon-oldalon letöltheti **ugyanazt** az aláírt APK-t, amelyet az admin használ; nincs felhasználónkénti build. A már telepített 1.0.2 app is működik, szerveroldali jogosultságokkal: a kezdő `/` kérés a readernél `/pokemon`-ra irányít.
6. Első appindítás: saját böngészős Google-belépés + az egyező kódú telefon jóváhagyása, majd visszatérés az appba és értesítési engedély.

A `ALLOWED_EMAIL` immár a védett bootstrap **tulajdonos**, jelenleg `wydrian@gmail.com`. Mindig admin; saját tulajdonosi hozzáférése nem demotálható/tiltható. További admin nem vonhatja vissza saját admin szerepkörét. Legfeljebb 100 felhasználó, e-mail normalizálás, rögzített szerepkörkészlet, szerepkörváltozás auditnaplóval. E-mail/jelszó vagy OAuth-token nem kerül az APK-ba.

## Azonnali hatály és visszavonás

A tényleges szerepkört minden kéréskor SQLite-ból ellenőrizzük. Nem a kliens által küldött szerepkört, form e-mailt vagy egy régi JWT-ben tárolt role-t fogadjuk el. Meglevő böngészős és mobil WebView-cookie-val is az új szerepkör érvényes. A natív eszközkulcs a **saját** fiókhoz kötődik; nincs idegen eszközlistázó vagy e-mail alapján történő natív visszavonási API.

Fiók letiltásakor minden Android- és böngészőeszköze revoked állapotú lesz, tokenje lekerül, queued/retry pushai cancelled állapotúak. Történelmi adatok, audit és bizonytalan/folyamatban levő küldések nem törlődnek; FCM-be már beküldött üzenet nem vonható vissza. Újraengedélyezéskor új telefonpárosítás vagy böngészős feliratkozás szükséges. Pusztán admin → reader szerepkörváltás nem törli a kapcsolatot; azonnal korlátozza a natív/WebView jogosultságokat.

## Független push beállítások és migráció

`dashboard_users` és `pokemon_user_notifications(email,shop_id)` táblák. Az eredeti admin `notify_new`, `notify_restock`, `notify_preorder` választásai egyszer átkerülnek a saját preferenciái közé; baseline-ok, közös ütemezés, eszközazonosítók/kulcshash-ek és Firebase-tokenek változatlanok. A régi shop-oszlopok csak kompatibilitási/migrációs adatként maradnak, nem kapcsolják le más felhasználó pushát.

Új readernél a webshoponkénti fogadás alapból engedélyezett, de csak kifejezetten párosított Android-eszköz vagy böngészőfeliratkozás kap üzenetet. Reader saját kapcsolója a fiók minden eszközére érvényes; az app natív kapcsolója vagy a böngészős leiratkozás csak az adott eszközt érinti. Admin eseménytípus-szűrője csak saját fiókjára hat; reader opt-in mellett minden új/visszakészletezés/előrendelés értesítést kap, mások típusszűrőitől függetlenül.

Preferencia változtatásakor csak saját, adott shophoz tartozó queued/retry üzenetek törlődnek; másik fiók, másik shop és már sending üzenet érintetlen. Visszakapcsolás nem küld történelmi eseményt. A worker új üzenet sorba állításakor **és beküldése előtt** ellenőrzi az aktív tagságot és preferenciát. Dedup/cooldown/TTL eszközönként marad, a telefonkvóta immár fiókonként 10.

Közös automatikus figyelést, intervallumot és kézi scant csak admin módosíthat. Ezek közös infrastruktúra-beállítások: egy shop leállítása mindenkinél szünetelteti a vizsgálatot. Admin saját értesítési kapcsolója ettől elkülönített, nem állítja le a monitorozást.

Telepítésnél a dashboard **és a worker** frissítendő (`scripts/Deploy-Pokemon.ps1`), mert a személyes push-szűrés a háttérfolyamatban is fut. A worker immutable release-ébe a `lib/users.ts` és a `lib/pokemon/notifications.ts` is bekerül. SMTP továbbra sincs.

## Ellenőrzés

Unit/regressziós tesztek: `tests/roles.test.ts`, `tests/navigation.test.ts`, eredeti mobil/FCM/adaptertesztek. HTTP-próba: `.runtime/research/test-roles-http.ts`, külön SQLite/adatkönyvtár és saját teszt-JWT-secret, localhost-only szerver, FCM kikapcsolva; sem valódi user/device adatot, sem éles AUTH_SECRET-et nem használ. Vizsgálja a landing oldalt, közvetlen API-tiltást, közös adatok egyezését, azonos APK-letöltést, hamisított admin actiont, saját beállítás identitás-manipulációját, szerepkörváltást és account disablet. Valódi új Google OAuth-belépés és fizikai telefonos FCM-kézbesítés külön felhasználói ellenőrzést igényel.

2026-10-02: 131 unit/regressziós teszt, típusellenőrzés és production build sikeres. 17 külön HTTP-ellenőrzés sikeres, többek között valódi Server Action form-POST saját/hamisított admin jogosultsággal, admin általi reader-felvétel, meglévő mobil JWT-vel való API-tiltás. Jelentés: `.runtime/research/roles-http-verified.json`. Éles telepítés utáni megőrzési/jogosultsági ellenőrzés scriptje: `.runtime/research/verify-roles-deployment.ts`; nem hoz létre tesztfiókot az éles adatbázisban.

Éles telepítés UAC-jóváhagyással sikeres (exit 0), ellenőrzés `2026-10-02T15:48:07.637Z`: tulajdonos admin, 12 webshop beállításai/baseline-jai és az eredeti értesítési preferenciák megmaradtak; 1 meglévő telefonpárosítás, eszközkulcshash és Firebase-token változatlan. Eseményelőzmény és publikált APK változatlan, worker él, mindhárom szolgáltatás Running. Az új worker release tartalmazza a szerepkör- és személyes push-modulokat. Nincs tesztfiók az éles adatbázisban; a felhasználó az ellenőrzés közben már felvett 1 valódi reader fiókot, ezt az owner-audit igazolta és nem módosítottuk. Anonim oldalak/API-k és hamis natív bearer tiltása ellenőrizve. Jelentés: `.runtime/research/roles-deployed.json`. Valódi reader Google-belépés és telefonos FCM-beérkezés még külön ellenőrizendő.
