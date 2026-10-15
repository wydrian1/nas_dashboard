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

Minden új/átírt történetmodult a **nullpont-story-steward** agent validál az elfogadás
előtt. Privát storyboardja nem kerül a játékba vagy Gitbe. Az exact-byte narratív
jóváhagyást a `npm run check:story` kapu ellenőrzi, a kiadási csomag is megköveteli.
Munkafolyamat: [történetellenőrzés](../../docs/nullpont-story-review.md).

A nagyítható ASCII-jeleneten jelölsz ki környezeti elemet; a kijáratra kattintva
mozogsz. Érkezéskor az alap környezet már látható, külön körülnézési lépés nélkül.
A közelebbi vizsgálat további részleteket fedhet fel, és minden nyitófejezeti célpont
érdemi leírást ad. Nincs külön környezet-, mozgás- vagy akciódoboz, látható
mentés/lépésszámláló vagy állandó oktatófelirat.
Az egymásba ágyazott közelnézetek saját ASCII-képet kapnak; a helyzetjelző mutatja
a fizikai helyszínt és a részletek útvonalát. Visszaléphetsz egy szinttel vagy a
helyzetjelző korábbi elemére kattintva. A közelnézet mentés és újratöltés után is
megmarad. A megfelelő környezeti célpont címkéjében szöveges/számzáras bevitel is
megjelenhet; a megoldások nem kerülnek a böngészőnek küldött játékadatokba.

A történetben megismert irány rövid célként látszik a helyzetjelző alatt, és a
haladással változik; nem mutat még ismeretlen célt vagy feladványmegoldást.
Környezeti szerkezetet a saját címkéjén megjelenő működtetésikonnal kezelhetsz.
Az inventoryban végzett tárgykombinálás közelnézetben is működik, nem léptet ki
onnan. A motor csak a kifejezetten `portable` jelölésű, két meglévő tárgyhoz
kötött kombinálási szabályt teszi helyfüggetlenné; környezeti célpontot, mozgást
vagy rejtett felfedezést nem emel át másik nézetből.

A célpont címkéje
rámutatásra, fókuszra vagy érintésre mutatja a nevét és a kompakt műveletikonokat;
az ikonok hozzáférhető neve és tooltipje megmarad.
Billentyűzettel a lefelé nyíl a címke műveleteire lép, Escape bezárja azt.
Az inventory tárgyrajzokat mutat: a címkén a Használom után a jelenet célpontjára,
a Kombinálom után a másik inventorytárgyra kattints. Nincs előre megjelenített
kombinációs recept vagy nyerő műveletlista. Csak a ténylegesen felfedezett elemek
kattinthatók; a felvett tárgy rajza eltűnik a jelenetről. Sikertelen kísérlet nem
pusztít tárgyat. Keskeny képernyőn a rajz külön, oldalra görgethető.
Asztali nézetben az inventory a jelenet jobb oldalán van, mobilon alatta. Az aktív
használat/kombinálás kis jelzése és törlése az inventoryban marad.

A Játék újrakezdése külön megerősítéssel a saját mentést állítja nyitóállapotra,
beleértve az inventoryt, felfedezéseket, naplót és történetkönyvet. Más fiókhoz
nem nyúl. A mentés revíziója tovább nő; elavult böngészőfül nem törölhet frissebb
haladást, és újrakezdés után sem írhatja vissza a régi állapotot.

Új fejezet: `lib/game/chapters/<nev>.ts`, regisztráció `lib/game/catalog.ts`-ben.
A `connections` régi helyszínhez adhat új kijáratot. A fejezet adja a környezeti
elemeket, feltételeiket, műveletmintáikat, felfedezéseiket és mérföldkőprózájukat.
A kliens csak az aktuális, felfedezett világ nézetét kapja, nem recepteket vagy
jövőbeli tartalmat. Régi azonosítót és megszerzett könyvlapot nem írunk át.
Nincs tervezett vég, és minden új fejezet minden elérhető állapota folytatható legyen.
Az AI fejlesztéskor írja a történeteket; nincs új fizetős futásidejű modellintegráció.

Új modulhoz minden környezeti elem és kijárat kapjon `artSpots` téglalapot
(nullától számozott sor/oszlop és méret); az `itemArt` adja az inventoryrajzot.
A `connections.artSpots` régi jelenethez adhat új célpontot. A katalógus ellenőrzi
a koordinátákat és a teljes lefedettséget; régi, hotspot nélküli moduloknál a nézet
kompatibilis ASCII-célpontokat illeszt a rajz alá. A kapcsolódó feltételeket és
rejtvényrecepteket nem küldi a kliensnek.
Az `arrivalDiscoveries` csak a helyszín alapvető környezeti elemeit sorolja fel;
érkezés nem futtat vizsgálati szabályt, nem ír könyvlapot/naplót és nem számít új
lépésnek. Régi modulnál a célpont nélküli körülnézési szabály felfedezéslistája
szolgál kompatibilis alapként. Régi mentés beolvasásakor csak az aktuális szoba
alapfelfedezései pótlódnak memóriában; a mentett revízió, történelmi próza és az
adatbázis bájtjai olvasáskor nem változnak. A további kísérletek nem ismételnek
biztonsági garanciákat vagy közvetlen megoldási recepteket.

ASCII-készítési eszközök és helyi modelllehetőség:
[tervezési útmutató](../../docs/nullpont-ascii-art.md). Ezek fejlesztési segédeszközök,
nem új futásidejű függőségek.

## Mentés / rollback

Az önálló `nullpont.sqlite`-ot a Node SQLite backup API-jával mentsd, integrity és
foreign-key ellenőrzéssel, privát helyre. A dashboard napi mentésétől ez külön
alkalmazásadat; a külön adatkönyvtárnak saját mentési ütemezés kell. Frissítés előtt
őrizd meg a korábbi alkalmazáscsomagot és konzisztens adatpillanatképet. Hiba esetén
először alkalmazásrollback: játékos haladását ne írd felül vakon régi adatbázissal.

Tesztek: `npm test`, `npm run typecheck`, staging `npm run build`,
`npm run test:browser`. A böngészőteszt kizárólag szintetikus adatot használ;
`NULLPONT_SCREENSHOT_DIR` mellett asztali/mobil előnézetet is készít.
