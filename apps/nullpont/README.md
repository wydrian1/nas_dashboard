# NULLPONT — önálló alkalmazás

Ez a könyvtár önmagában telepíthető: nincs dashboard-import, közös adatbázis,
közös sütikulcs vagy dashboard-szolgáltatásfüggőség. Node.js **24** szükséges.

## Telepítés

1. Másold kizárólag ezt a könyvtárat egy külön alkalmazáskönyvtárba.
2. `npm ci --ignore-scripts --no-audit --no-fund`.
3. A `.env.example` alapján készíts saját, privát `.env.local` fájlt. Külön
   Google OAuth-kliens/callback és saját `AUTH_SECRET` kell. A Google callback:
   `https://SAJAT-JATEK-HOST/api/auth/callback/google`. A belépés csak ellenőrzött
   Google e-maillel, `NULLPONT_ALLOWED_EMAILS` vagy importált, aktív tagsággal működik.
4. `NULLPONT_DATA_DIR` saját, abszolút adatkönyvtár. Az alkalmazásfiók csak ehhez,
   saját buildjéhez és szükséges saját konfigurációjához kapjon hozzáférést.
5. `npm run build`, majd `npm start`. Saját loopback port: **3100**. Külön HTTPS
   reverse proxy és külön szolgáltatás szükséges. Ne állítsd át a dashboardot.

PowerShellben az npm futtatásához a Node könyvtárát processzlokális PATH-ba tedd.
A buildhez használható `$env:DASHBOARD_BUILD_DIR='.next-staging'`; az alkalmazás
indításakor a buildkönyvtárnak egyeznie kell (`.next` az alapérték).

## Ellenőrzött kiadási csomag

`npm run package:release -- --destination <uj-abszolut-konyvtar>`

Ez staging buildet, teljes játéktesztet, típusellenőrzést és izolált
böngészőtesztet futtat. A generált deklarációt helyreállítja a tesztek előtt.
Csak siker után hoz létre új, önálló csomagot: forrás, saját package-lock,
`.next` build és hash-manifest. Nem csomagol `.env.local`-t, adatot, titkot vagy
dashboard-forrást. Célkönyvtárat nem ír felül. A csomagban `npm ci`, saját env és
`npm start` elegendő; a dashboard Node-moduljai nem szükségesek.
Külön release deploy/rollback szükséges; a NAS dashboard delegált élesítője nem
kapott új szolgáltatásjogot. Semmi nem települ automatikusan.

## Régi játékállások átvitele

1. Az eddigi dashboardról konzisztens SQLite **backup API-pillanatképet** készíts.
   Ne a nyitott adatbázis `.sqlite` fájlját másold, mert a WAL hiányozhat.
2. Állítsd meg az új játékot az import idejére. A céladatbázis még ne létezzen.
3. `npm run import:dashboard -- --source <backup.sqlite> --destination <uj-adatkonyvtar/nullpont.sqlite> [--owner-email <tulajdonos>]`
4. Az import csak az `adventure_saves` mentéseket és az aktív/inaktív tagságot
   viszi át. Nem másol pénzügyet, jegyzetet, tokent, OAuth-kulcsot vagy szerepkört.
   A forrást csak olvassa; meglévő céladatbázist soha nem ír felül. A régi mentések
   maradjanak meg a dashboard-mentésben a sikeres átvitel és visszaellenőrzés után is.
5. Az e-mailazonosság köti a mentést a külön Google-belépéshez. A v1 mentésből v2
   lesz: a felfedezések pótlódnak, a helyszín, inventory, revízió, utolsó üzenet,
   napló és történetkönyv változatlan marad. Sérült mentés az egész importot megállítja.

Az import aktív dashboard-tagságot vihet át, de a későbbi jogosultságkezelés
önálló. A `players.enabled=0` a még élő JWT-t is azonnal blokkolja.
A saját `nullpont.session-token`/`__Secure-nullpont.session-token` host-only
süti nem használható a dashboardba belépésre és fordítva.

## Játék és folytatás

Mozgás, akció, felfedezett környezet, inventory. Kijelölsz egy tárgyat, majd
egy környezeti elemet vagy másik tárgyat, és választasz egy általános igét.
Nincs előre megjelenített kombinációs recept vagy nyerő műveletlista.
A környezeti elemek csak a tényleges felfedezésük után kerülnek a panelre;
a felvett tárgy onnan az inventoryba kerül. Sikertelen kísérlet nem pusztít tárgyat.

Új fejezet: `lib/game/chapters/<nev>.ts`, regisztráció `lib/game/catalog.ts`-ben.
A `connections` régi helyszínhez adhat új kijáratot. A fejezet adja a környezeti
elemeket, feltételeiket, műveletmintáikat, felfedezéseiket és mérföldkőprózájukat.
A kliens csak az aktuális, felfedezett világ nézetét kapja, nem recepteket vagy
jövőbeli tartalmat. Régi azonosítót és megszerzett könyvlapot nem írunk át.
Nincs tervezett vég, és minden új fejezet minden elérhető állapota folytatható legyen.
Az AI fejlesztéskor írja a történeteket; nincs új fizetős futásidejű modellintegráció.

## Mentés / rollback

Az önálló `nullpont.sqlite`-ot a Node SQLite backup API-jával mentsd, integrity és
foreign-key ellenőrzéssel, privát helyre. A dashboard napi mentésétől ez külön
alkalmazásadat; a külön adatkönyvtárnak saját mentési ütemezés kell. Frissítés előtt
őrizd meg a korábbi alkalmazáscsomagot és konzisztens adatpillanatképet. Hiba esetén
először alkalmazásrollback: játékos haladását ne írd felül vakon régi adatbázissal.

Tesztek: `npm test`, `npm run typecheck`, staging `npm run build`,
`npm run test:browser`. A böngészőteszt kizárólag szintetikus adatot használ;
`NULLPONT_SCREENSHOT_DIR` mellett asztali/mobil előnézetet is készít.
