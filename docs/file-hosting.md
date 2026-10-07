# Fájlhosting

## Felület és hozzáférés

Admin-only **Fájlok** (`/files`): új mappa, mappába lépés, egy vagy több fájl feltöltése, admin letöltés, lejáró vagy állandó aláírt megosztási link készítése/másolása/visszavonása. A Pokémon-reader és info-reader nem látja a menüt; oldal és minden admin API ellenőrzi a jogosultságot, még a feltöltési törzs vagy privát lista olvasása előtt. Írásnál a meglévő két dashboard HTTPS-eredethez illeszkedő Origin-ellenőrzés is kötelező. Nem jogosultságbővítés a mobil readereknek.

A letöltési linket **bárki használhatja, aki ismeri**; nincs bejelentkezés, és nincs könyvtárlista. Ne küldj bizalmas fájlt nem megbízható címzettnek. A link visszavonása/lejárata új letöltéseket tilt: már elindult letöltést vagy a címzett által mentett másolatot nem von vissza.

Nincs automatikus vírusellenőrzés vagy tartalmi minősítés: a letöltést kényszerítjük, nem a fájl veszélytelenségét garantáljuk. Csak megbízható tartalmat ossz meg.

## Tároló

Éles futásnál kizárólag **`D:\!nas\data\file-hosting`**; a kód `process.cwd()/data/file-hosting` útvonalat használ, így a tesztek izolált könyvtárban működnek. Nincs tárolóválasztó a weben, és nincs automatikus import/keresés a NAS korábbi fájljai között. Nincs Caddy static-file mapping és nincs Next `public` alá feltöltés.

A weben megadott mappa-/fájlnevek SQLite-metaadatok; a tényleges mappák és fájlok **véletlen opaque azonosítókkal** kerülnek a dedikált tárolóba (mappák hierarchikusan, fájlok `<id>.blob` néven). Így felhasználói név nem alkot lemezútvonalat. A webes név/hierarchia és a bájtok helyreállításához **együtt kell menteni a SQLite-adatbázist és a hosting könyvtárát**. `data/` marad ignorált: sem tartalom, sem valódi link/aláírókulcs nem kerül GitHubra vagy deployment artifactba. Ebben a source-frissítésben a meglévő titkosított backup explicit mentési köre kiegészül `data/file-hosting` tartalmával; nagy hostingállományok a mentés tárhelyigényét és futásidejét is növelik. A production mentőkódot ezzel a PR-ral nem cseréljük le automatikusan.

A schema új `hosted_entries`, `hosted_links`, `hosted_audit` táblákat/indexeket hoz létre; más adat/azonosító/role/monitor/history nincs módosítva. A schema önálló az eddigi `db-schema.ts` fájlban: az immutable Pokémon-worker snapshot nem kap új importfüggőséget.

**A helyi OS-jogosultságoknak kizárólag megbízható folyamatok számára kell engedniük a tároló írását.** A kód minden tárolóősön tiltja a symlink/junction/reparse átirányítást, csak ismert objektumazonosítót nyit, letöltéskor ellenőrzi a rendes fájlt, méretet, inode/device egyezést és az egyetlen hardlinket. Ez nem védelem az OS-admin vagy a folyamat jogosultságával futó rosszindulatú helyi program ellen. Nem írunk át ACL-t vagy production könyvtárat pusztán a source PR készítéséért.

## Feltöltés

- A mappaútvonal egy közös alapvonalra igazított navigációs lista; az aktuális mappát `aria-current` jelöli. A menüsáv általános linkstílusai nem nyújtják szét a breadcrumbot.
- A „Fájlok kiválasztása” mező a sötét felülethez illő magyar megjelenítést és kiválasztott fájlnevet/darabszámot ad. Alatta valódi, billentyűzettel és Android WebView-ból is elérhető natív többfájlos input marad; nincs új fájlkezelő API. A kiválasztás sikeres feltöltés után ürül, hiba/megszakítás esetén megmarad. Keskeny nézetben a feltöltési és mappalétrehozási mezők/gombok egymás alá törnek.
- **1 GB = 1 000 000 000 bájt/fájl**, nulla bájtos fájl is támogatott.
- Raw-body `POST /api/files/upload?name=<urlencoded>&folder=<id>`; nincs multipart/server-action memóriabeli 1 GB-os buffering. A kliens Blobot küld XHR-rel, haladásjelzővel és megszakítással. Több kijelölt fájl sorban töltődik fel.
- Bejelentkezés és Origin ellenőrzése után méretkorlát a fejlécben **és** a tényleges streamen. Backpressure-es lemezírás és SHA-256 számítás, legfeljebb egyórás művelet.
- Nem ír felül azonos nevű fájlt/mappát (azonos mappában normalizált, kisbetűs névkulcs). Kizárólagos `wx` fájlnyitás; kész státusz csak az egész stream és lemez-sync után. Félkész objektum nem tölthető le/osztható meg.
- Szabadlemez-ellenőrzés induláskor (más folyamatban lévő feltöltések maximális méretének fenntartásával), írás közben 32 MiB-onként; legalább 256 MiB biztonsági tartalék. Nem teljes NAS-kvóta vagy garantált tárhelyfoglalás.
- Hiba, mérettúllépés vagy megszakítás eltávolítja az adott művelet félkész fájlját/rekordját. Process-crash után két óránál régebbi `uploading` objektumot a következő admin feltöltés/mappalétrehozás ellenőrzötten kitakarít; audit `recover`. A takarítás más/lemezről felfedezett fájlt nem érint.
- Legfeljebb 2 egyidejű feltöltési/mappalétrehozási művelet, 16 mappaszint, 500 bejegyzés/mappa, 10 000 bejegyzés összesen. Nincs fájlátnevezés/törlés/felülírás vagy mappamegosztás ebben a kiadásban.

## Aláírt link és letöltés

- Link: `https://nas.wydrian.hu/s/<id>.<HMAC>` vagy az aktuális `https://wydrian.hu` eredet. Mindkét domainen ugyanaz a fájl elérhető, redirect nélkül.
- 256 bites véletlen linkazonosító + domain-separated HMAC-SHA256 a meglévő tartós `AUTH_SECRET` használatával (minimum 32 karakter). Nincs fájlútvonal/név vagy credential a token payloadban. Kulcsot/logint nem adunk a kliensnek. **Az AUTH_SECRET cseréje az összes korábbi linket érvényteleníti**; az állandóság a fájl/metaadat/aláírókulcs fennmaradására értendő.
- Fájlazonosító és lejárat a szerveradatbázisból; a signature időzítésbiztos ellenőrzése után is kötelező a létező, nem visszavont, még élő link és kész fájl. Megváltoztatott/lejárt/visszavont/ismeretlen token egységes 404. Állandó = nincs lejárat, de bármikor admin által visszavonható. Lejáró = 1 óra/24 óra/7 nap/30 nap vagy egyedi jövőbeli időpont, max. 10 év. Linkek létrehozása/visszavonása auditált; fájlonként max. 100 link.
- `GET`/`HEAD`, teljes vagy egyetlen byte-tartományú streamelt letöltés (`206`, hibás range `416`), böngésző letöltés-folytatási támogatás. `application/octet-stream`, `attachment`, RFC 5987 fájlnév, `nosniff`, CSP sandbox, no-store, no-referrer és noindex. HTML/SVG/script sem szolgálható inline alkalmazásként a dashboard eredeten. Nincs publikus írás/lista/MIME-preview.
- Byte-alapú 64 KiB WebStream-puffer és lemezstream backpressure; legfeljebb 12 aktív letöltés/process, 4/fájl. Ez erőforrás-védelem, nem DDoS-garancia vagy sebességkvóta. Nagy publikus forgalom a NAS kapcsolatát terheli.
- Valódi linket ne írj megosztott logba, screenshotba, PR-ba; a böngésző/history és címzett hozzáférését nem tudjuk megszüntetni. Élesítéskor ellenőrizendő, hogy a proxy/monitor ne naplózza a `/s/` bearer URL-t.

## API-k

- `GET /api/files?folder=<id>`: aktuális admin lista/breadcrumbs/linkek, no-store.
- `POST /api/files/folders`: `{parent: id|null, name}`.
- `POST /api/files/upload`: raw body, query név/mappa.
- `POST /api/files/links`: `{fileId, expiresAt: epochMilliseconds|null}`.
- `DELETE /api/files/links`: `{id}` visszavonás.
- `GET/HEAD /api/files/<id>/download`: admin, link nélkül.
- `GET/HEAD /s/<signedToken>`: kizárólag adott fájl nyilvános letöltése.

Élesítés külön jóváhagyást igényel, az aktuális pénzügy/gyűjtemény source megőrzésével; staging és tesztállományok nem valódi feltöltések. A két domainen átmenő proxy-feltöltés/Range ellenőrzést az élesítési terv részeként kell elvégezni, nem szerverújraindítással a source PR-ért.

## Reprodukálható ellenőrzés

`npm test`, `npm run typecheck`, `DASHBOARD_BUILD_DIR=.next-staging npm run build`, majd `node --experimental-strip-types scripts/Test-FileHostingHttp.mjs`. Az HTTP-próba saját véletlen aláírókulcsot/szintetikus felhasználókat/adatbázist, `.runtime/research` fixture-t és loopback 3154 portot használ; production környezetet vagy adatbázist nem olvas. Ellenőrzi mindkét domain session-határait, CSRF-et, raw/chunked 12 MiB-os feltöltést, privát listát, publikus aláírt GET/HEAD/Range-et, lejáratot/visszavonást és saját tesztszervere újraindítása utáni állandó linket. A valódi nagyfájlos internetes proxyátvitel élesítéskor külön ellenőrzendő.
