# NULLPONT — önálló alkalmazás

Ez a könyvtár önmagában telepíthető: nincs dashboard-import, közös adatbázis
vagy közös sütikulcs. Csak a belépéshez használja a dashboard két HTTP-végpontját;
érvényes saját munkamenettel a játék önállóan működik. Node.js **24** szükséges.

## Telepítés

1. Másold kizárólag ezt a könyvtárat egy külön alkalmazáskönyvtárba.
2. `npm ci --ignore-scripts --no-audit --no-fund`.
3. A `.env.example` alapján készíts saját, privát `.env.local` fájlt. **Nem kell
   új Google OAuth-kliens, callback vagy Google-titok.** A meglévő dashboard
   azonosítja a játékost. `AUTH_URL` a játék saját HTTPS originje;
   `NULLPONT_DASHBOARD_URL` a meglévő dashboard HTTPS originje (pl. nas.wydrian.hu).
   A játékhoz saját `AUTH_SECRET` kell, nem a dashboard munkamenetkulcsa.
   Mindkét alkalmazásban azonos, külön generált, legalább 32 karakteres
   `NULLPONT_SSO_SECRET` kell a szerverközi kódbeváltáshoz; a dashboardban
   `NULLPONT_URL` legyen a játék originje. Csak a loopback 127.0.0.1 használhat HTTP-t.
   A NAS-on a cím `https://wydrian.hu/nullpont`: `NULLPONT_BASE_PATH=/nullpont`
   buildkor és futáskor is szükséges, az `AUTH_URL` és a dashboard `NULLPONT_URL`
   tartalmazza ezt az előtagot. A proxy a teljes útvonalat adja a 3100-as szolgáltatásnak.
   Itt a saját Secure/HttpOnly/SameSite=Lax sütik Path=/nullpont hatókörűek;
   nincs __Host- előtag (az csak Path=/ mellett használható). Az azonos web-origin
   nem böngészőbiztonsági izoláció, de a munkamenetkulcs és az adatbázis külön marad.
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
A saját `nullpont.session-token`/`__Host-nullpont.session-token` host-only
süti nem használható a dashboardba belépésre és fordítva.

## Belépés a meglévő dashboardból

A játék megnyitása automatikusan a dashboardhoz irányít, amely a már meglévő
bejelentkezést ellenőrzi. Nincs új Google-képernyő, ha ott még érvényes a belépés.
Ha a dashboard munkamenete lejárt, előbb ott kell belépni, majd újra megnyitni a
játékot. A játék 12 órás, saját aláírt munkamenetet kap; saját kilépése nem léptet
ki a dashboardból. Lejárat után az átadás újra lefut.

Az átadás 60 másodperces, véletlen, egyszer használható kóddal, state és PKCE
ellenőrzéssel működik. Csak a kód hash-e kerül a dashboard adatbázisába. A callback
címe fix konfiguráció, nincs felhasználói redirect URL. A kód csak szerverközi,
dedikált kulccsal hitelesített POST-on váltható be; ekkor a dashboard jogosultságát
újra ellenőrizzük. A címsorból azonnal eltűnik, a válasz no-store/no-referrer.
HTTPS-en a state és a játék munkamenete __Host-, HttpOnly, SameSite=Lax sütiben él.
Nem osztunk meg dashboard-sütit, OAuth tokent vagy dashboard AUTH_SECRET-et.

A dashboard azonosítási hatóság; az első sikeres átadás helyi játékost hoz létre,
de egy helyi `players.enabled=0` tiltást nem old fel. A dashboardban később tiltott
fiók nem kaphat új játék-munkamenetet. A már kiadott játék-munkamenet maximum 12
óráig élhet (helyi tiltás azonnal leállítja); nincs közös, globális kiléptetés.
Önálló telepítés és adatkezelés megmarad, belépéskor a dashboardnak elérhetőnek kell lennie.

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
