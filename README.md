# Wydrian Dashboard

Windows alatt futó privát dashboard. Next.js, Auth.js Google-belépés és SQLite; csak előre engedélyezett, Google által igazolt fiók léphet be. Tulajdonos/admin: `wydrian@gmail.com`; további `admin` és `pokemon-reader` fiókok a Konfig / Felhasználók részen kezelhetők. Részletes jogosultságok: `docs/roles.md`.

## Indítás

1. Node.js 24 LTS szükséges. A `.runtime` mappában projektlokális példány található.
2. OAuth import: `powershell -ExecutionPolicy Bypass -File scripts/Import-OAuth.ps1`.
3. A helyi Node könyvtárát tedd a folyamat PATH-jába, majd `npm ci` és `npm run build`.
4. `powershell -ExecutionPolicy Bypass -File scripts/Start-Dashboard.ps1`.
5. Helyi teszt: **http://localhost:3000**. A Google-kliensben ennek callback címe is legyen engedélyezve: `http://localhost:3000/api/auth/callback/google`.

Az alkalmazás csak `127.0.0.1`-re köt. A Google-belépés nem helyettesíthető fejlesztői bypass-szal.

## Publikus üzemeltetés

- `.env.local`: `AUTH_URL=https://nas.wydrian.hu`, majd újraindítás.
- Google callback: `https://nas.wydrian.hu/api/auth/callback/google`.
- Caddy: `caddy run --config deploy/Caddyfile --adapter caddyfile`.
- A konfiguráció nem foglalja el az IIS által használt 80-as portot. A tanúsítványhoz TLS-ALPN-01 ellenőrzést használ a 443-as porton. A routernek és a tűzfalnak ezt engednie kell; a publikus DNS A/AAAA rekordoknak is helyesnek kell lenniük.
- A 3000-es portot ne továbbítsd és ne nyisd meg a tűzfalon.
- Az automatikus induláshoz külön Windows-szolgáltatást kell telepíteni a dashboardhoz és a Caddyhez (például WinSW). Az alkalmazás és a TLS tanúsítványok adatai a szolgáltatás felhasználójától is függnek. A titokfájl csak a jelenlegi felhasználó és SYSTEM számára olvasható.
- Ehhez készült a `scripts/Install-Services.ps1`: rendszergazdai PowerShellben futtasd, miután a próbaüzemi 3000/443 folyamatok leálltak. Két automatikusan induló WinSW-szolgáltatást és egy programhoz kötött TCP 443 tűzfalszabályt hoz létre. Nem módosítja az IIS-t. LocalService fiókhoz olvasási jogot ad a projekt/titok fájlokhoz és írási jogot az adat-, napló- és cache-mappákhoz. **A régi telepítő XML-jének `<username>` mezője nem állította át a tényleges Windows-szolgáltatásfiókot: a 2026-10-01-i ellenőrzéskor a dashboard és HTTPS LocalSystem alatt futott.** Ezek módosítása külön üzemeltetési feladat, a Pokémon-telepítés nem változtatja meg őket. Meglévő azonos nevű szolgáltatást nem ír felül. Szolgáltatástelepítéskor a publikus AUTH_URL-re állítja a konfigurációt.
- Caddy tanúsítványtár: `data/caddy`. Ezt is mentsd biztonságosan. A tesztindításhoz: `scripts/Start-Caddy.ps1`.
- A telepítő UAC-jóváhagyással is indítható a `scripts/Install-Elevated.ps1` segítségével. Naplója: `logs/installation.log`. A próbaüzemi folyamatokat csak akkor állítja le, ha az adott porton a projekt saját Node/Caddy példánya fut.

## Szolgáltatások kezelése

Rendszergazdai PowerShellben:

```powershell
Get-Service WydrianDashboard,WydrianHttps
Restart-Service WydrianDashboard
Restart-Service WydrianHttps
```

Alkalmazásfrissítéskor: állítsd le a `WydrianDashboard` szolgáltatást, futtasd a `scripts/Build-Dashboard.ps1` scriptet, majd indítsd vissza. OAuth-beállítás módosítása után csak a dashboardot kell újraindítani. A Caddy konfigurációjának módosítása után a `WydrianHttps` szolgáltatást indítsd újra. A `logs` mappában külön szolgáltatásnaplók vannak; ezeket ne publikáld titkok ellenőrzése nélkül.

Rövid leállású frissítés: először `DASHBOARD_BUILD_DIR=.next-staging` környezeti változóval készíts buildet, majd rendszergazdaként futtasd a `scripts/Activate-Build.ps1` scriptet. Ez csak a dashboardot indítja újra, megőrzi a régi buildet időbélyeges `.next-backup-*` mappában, és sikertelen induláskor visszaáll rá. A buildmentések nem részei az adatbázismentésnek; automatikusan nem töröljük őket.

Teljes projekt költöztetése a RAID-meghajtóra (`D:\!nas`): [docs/project-move.md](docs/project-move.md), `scripts/Move-Project.ps1`. A szolgáltatások és tűzfalszabály útvonalai is átállnak; az eredeti könyvtár ellenőrzésig és utána visszaállítási másolatként megmarad. A RAID mellett is szükséges külön backup.
- A qBittorrent/Plex/Jellyfin közvetlen külső portjait a dashboard nem védi. A csempék megnyitási hivatkozásai saját szolgáltatásbelépést igényelhetnek: qBittorrent `https://nas.wydrian.hu:8081/`, Jellyfin `https://nas.wydrian.hu:8920/`, Plex `https://app.plex.tv/desktop/`. A hivatkozások miatt nem nyitunk további portokat. A Plex webapp használatához a Plex saját távoli elérési beállításai érvényesek.

## Funkciók és korlátok

- HTTP-állapotellenőrzés: qBittorrent 8081, Plex 32400, Jellyfin 8920. A válaszadás nem teljes működési teszt. A 401/403 külön jelzés.
- Rendszerállapot: teljes gép CPU-terhelése, összes/szabad fizikai RAM és a helyi fix meghajtók összes/szabad kapacitása. Bejelentkezéssel védett `/api/system` végpont, 30 másodperces mintavételi gyorsítótár. CPU: a processzormagok összesített számlálóinak különbsége, nem az alkalmazás CPU-fogyasztása. Meghajtók: rögzített, paraméter nélküli PowerShell CIM lekérdezés; hálózati és cserélhető meghajtók nem szerepelnek. GiB/TiB egységek. Ha a meghajtólekérdezés hibázik, külön figyelmeztetés jelenik meg.
- Gyorslinkek: hozzáadás/szerkesztés/törlés, legfeljebb 60 HTTP/HTTPS link. Nincs szerveroldali link- vagy faviconlekérés. A céloldalak saját hitelesítést igényelhetnek.
- Jegyzetek: cím és egyszerű szöveg (max. 5000 karakter), szerkesztés/törlés, legfeljebb 50 jegyzet. Teendők: hozzáadás/szerkesztés/törlés és kész/elvégzetlen állapot, legfeljebb 100 feladat. Minden adat SQLite-ban és a meglévő mentésben marad; minden módosítás szerveroldali jogosultságellenőrzést kap.
- Időjárás: saját település keresése és kiválasztása; nincs automatikus helymeghatározás vagy alapból beállított lakóhely. Open-Meteo jelenlegi modellalapú adatok és 5 napos előrejelzés, Celsius és km/h, 15 perces gyorsítótár. Az ingyenes API személyes/nem kereskedelmi használatra szolgál, külön kulcs nélkül; forrásmegjelölés a felületen. Hálózati hiba külön jelzés; korábbi adatok legfeljebb 6 órán át, elavultként jelölve használhatók. A településkeresés és a koordináták a külső Open-Meteo szolgáltatóhoz kerülnek; a jegyzeteket/linkeket nem küldjük el. Védett végpontok: `/api/weather`, `/api/weather/locations`.
- Pokémon TCG figyelő: külön, védett `/pokemon` oldalon, a fő dashboard oldalsávjából elérhető. Felül a webshopok közös, legutóbbi 60 elérhetőségi eseménye időrendben, webshop-/eseményszűrővel; alatta a GameRunner, MythGames, Pöttyös Zebra, GrandLine, Krodom Cards, JátékNet, Reflexshop, GeekEmpire, TCG Futár, Sport Kártya Bolt, RT Collectors Club és Cardverse önálló kártyái/beállításai. MythGames és a külön jóváhagyott RT Collectors Club: szerepel a készletszűrt listában = elérhető, külön termékoldal-, variáns- vagy kosárgomb-ellenőrzés nélkül. A többi webshopnál aktív „Kosárba” gomb = elérhető, előrendelések is; a készletszöveg tájékoztató. GrandLine/JátékNet: a robots-tiltott szűrős URL helyett az engedett teljes kategóriát olvassa helyi szűréssel; JátékNetnél a Pokémon-címválasztás a webshop Pokémon-számlálójával is egyezik. Krodom Cards: a megadott kategória/gyártó szűrés teljes Pokémon-kínálata, az „Értesítés” ál-kosárgombok kizárásával. Reflexshop: a megadott keresés teljes listája, az itt megjelenő általános kártyavédőkkel együtt. GeekEmpire: teljes WooCommerce Pokémon-kategória, robots szerinti 5 mp lekérési szünettel. TCG Futár: a teljes kumulatív kategóriát az első nézettől olvassa, nem csak a megadott negyedik nézetet; kosárgomb nélkül nem elérhető. RT Collectors Club: csak a robots-engedett egyetlen készletszűrő, tiltott rendezés és üres árszűrők nélkül. Cardverse: a három kiválasztott szűrő és a teljes darabszám JSON-metaadatát is validálja; az ikon alakú kosárgomb „Kosárba” aria-labelje számít. JátékNet, Reflexshop, GeekEmpire, Sport Kártya Bolt és Cardverse csak a jelenleg igazolt teljes, egyoldalas listát fogadja el; új lapozásnál hibát jelez és megőrzi az előző állapotot. Külön `WydrianPokemon` Windows-worker, webshoponként alapból tízpercenként, 5–60 percre állítható; csendes első baseline, tartós változásnapló, kézi vizsgálat ütemezése, szüneteltetés és kizárólag Firebase push értesítések. E-mail-küldés nincs. Dokumentáció: `docs/pokemon-shops/` webshoplapjai, eredeti modulterv: `docs/pokemon-monitor-plan.md`. CollectKing és Alza HTTP 403, REGIO igazolt teljes terméklista hiánya miatt nincs bekapcsolva; ezek nem nulla készletes eredmények.
- RSS/Atom: legfeljebb 20 nyilvános HTTPS-forrás, címellenőrzéssel és DNS-címrögzítéssel. Címeket, linkeket és képes enclosure előnézeteket jelenít meg, nyers HTML-t nem. A HTTPS képeket a böngésző közvetlenül, lusta betöltéssel, referrer nélkül tölti le; nincs szerveroldali képoptimalizáló/proxy. Hang/videó/SVG és nem biztonságos kép-címek nem jelennek meg; képhibánál a cikk képe nélkül látszik. RSS `enclosure` és Atom `link rel="enclosure"` támogatott.
- RSS: oldalmegnyitáskor, 15 perces gyorsítótárral; kézi frissítés is elérhető. Nincs még önálló háttérütemező. Forrásonként 1–100 legfrissebb hír választható, alapérték 20; új forrásnál és a meglévő forrás melletti Mentés gombbal is beállítható. A teljes RSS XML letöltődik, a limit a belőle feldolgozott és megjelenített cikkekre vonatkozik. Ha a forrás kevesebb hírt ad, ennyi jelenhet meg. A megőrzött archívum legfeljebb 500 cikk forrásonként; a limit csökkentése nem törli az archívumot vagy az olvasottságot. Nincs közös 100-as megjelenítési plafon a feedek felett.
- Az új adatbázismezők automatikus migrációval kerülnek be. A meglévő források alaplimitje 20 lesz, a korábbi cikkek és olvasottságuk megmarad. Az első látogatás frissíti a forrásokat a képekhez. Élesítés előtt az aktiváló script konzisztens SQLite-mentést készít a `data/backups` mappába; sikertelen mentésnél nem cseréli le a buildet.
- Olvasottság és források: `data/dashboard.sqlite`.
- A helyi qBittorrent- és Jellyfin-ellenőrzés HTTPS-t használ, és elfogadja a helyi tanúsítványt, kizárólag a rögzített loopback címeken és portokon. RSS-nél rendes TLS-ellenőrzés van.
- A Google Fonts külső betűtípusokat tölt le; offline rendszerbetűvel működik.

## Tesztek és mentés

`npm run typecheck`, `npm test`, `npm run build`.

A SQLite-ból kapott sorokat a `plainSqlRow` segédfüggvénnyel sima objektummá alakítjuk a felületnek történő átadás előtt. A Node SQLite null-prototípusú rekordjait a React szerver–kliens határa nem fogadja el; külön regressziós teszt ellenőrzi a mentett időjárás-helyszínt is.

Mentéskor állítsd le a dashboardot, és mentsd a `data` mappát és a `.env.local` fájlt biztonságos, nem publikus helyre. Futó SQLite adatbázisból ne csak a fő fájlt másold: a WAL fájlokban is lehetnek adatok.

## Oldalak és konfiguráció

Az alábbi teljes oldalkészlet admin jogosultsághoz tartozik. A `pokemon-reader` alapoldala a `/pokemon`, a többi oldalt/API-t és admin Server Actiont nem éri el. A védett APK-letöltés és saját telefonjának böngészős párosítása/natív kezelése engedélyezett, de a `/mobile` eszközlista nem. Konfig / Felhasználók alatt Google e-mail alapján vehetsz fel fiókokat, adhatsz szerepkört vagy tilthatsz le hozzáférést; nincs nyílt regisztráció.

- `/`: **Dashboard**; szolgáltatások, gyorslinkek (csak megnyitás), időjárás, rendszerállapot. Az utóbbi három szekcióhoz nincs külön főmenülink.
- `/notes`: külön, védett **Jegyzetek és teendők** oldal, változatlan hozzáadással/szerkesztéssel/törléssel és készre jelöléssel. Meglévő jegyzetek és feladatok megmaradnak.
- `/news`: külön, védett hírolvasó, RSS-frissítés és olvasott/olvasatlan jelölés. Üres lista esetén a Konfig RSS-szekciójára mutat.
- `/config`: külön, védett **Konfig** oldal; gyorslinkek, RSS-források, felhasználók és **Telefonok / push** (`#mobile`) kezelése. A régi `/mobile` cím admin esetén ide irányít; reader továbbra sem fér hozzá az eszközlistához. Párosítás, APK-letöltés és natív API változatlan.
- `/pokemon`: a lap tetején minden webshop neve belső gyorslink (`#shop-…`), amely az adott webshop kártyájához ugrik.
- `/finance`: admin-only **Pénzügy**; importált havi vagyoni állapotok, legfrissebb hónap alapnézettel, teljes előzményválasztóval, gyarapodási grafikonokkal, DEBT-fordulókkal és kézi havi rögzítéssel. A Pokémon-reader sem oldalhoz, sem pénzügyi API-hoz/mentéshez nem fér hozzá. Részletek és importfolyamat: [docs/finance.md](docs/finance.md).
- `/opencode`: kizárólag a tulajdonosnak, az eredeti OpenCode 2 webfelületével, védett külön aldomainen, a dashboardba beágyazva. Weben és Android **1.0.3**-tól érhető el. Rövid HttpOnly hozzáférés, visszavonás és üzemeltetés: [docs/opencode.md](docs/opencode.md). Nem indítja újra a meglévő OpenCode-ot.
- `/config#admin-helper`: owner-only, külön áttekintéssel/megerősítéssel a négy NAS-szolgáltatás újraindítása. Az OpenCode csak kérést küldhet; nincs shell, telepítés vagy build-élesítés. Saját nem-admin Windows-fiók, védett Program Files telepítés, egyszeri helyi UAC. Részletek és korlátok: [docs/admin-helper.md](docs/admin-helper.md).

Metagames készletszűrt Pokémon-kategória, teljes nullától indexelt lapozás és csendes első baseline: [docs/pokemon-shops/metagames.md](docs/pokemon-shops/metagames.md). Ez a **13. webshop**; a meglévő kereső és saját push-beállítások rá is érvényesek. Webes és Android 1.0.4-es W/csempe ikon: [docs/branding.md](docs/branding.md). Forrásváltozás nem élesíti automatikusan a dashboardot/workert vagy az új APK-t.

A pénzügyben kiemelt reálnövekedés-oszlopdiagram (automatikus KSH CPI), vagyonösszetétel-kördiagram, fejlécbeli ECB/Frankfurter USD/HUF és EUR/HUF, Collectr-előtöltés és USD→Ft szerveroldali mentés működik. Legalul szerkeszthető LEGO-lista. Új hónapnál csak a Lili/Bali DEBT értékei másolódnak az előző állapotból; Pokémon a Collectrből, LEGO a listaösszegből, minden más mező üres. Korábbi havi értékeket a külső források/listamódosítások nem írnak át.

A Pokémon-oldal felső „Legújabb elérhetőségek” listája legfeljebb 60 **továbbra is elérhető** termék eseményét mutatja. A termék már az első elfogadott teljes vizsgálatban megállapított hiány után eltűnik innen (`in_stock=1`, `missing_count=0` szükséges). Hibás/hiányos vizsgálat vagy megerősítésre váró nagy készletcsökkenés nem üríti ki a listát. A történelmi eseményadatok megmaradnak az adatbázisban; visszakészletezésnél csak az aktuális elérhetőségi epizód eseménye kerül vissza a felső listába, nem a korábbi eseményei. A két hiányzó vizsgálatos visszakészletezési logika, baseline, push és webshopbeállítások nem változnak. A szűrés a 60-as SQL-limit előtt történik, és a 15 másodperces API-frissítésen át az appban is érvényesül; nem kell új APK.

Mind a felső listában, mind a webshoponkénti **Legutóbbi változások** szekciókban csak az elmúlt **24 óra továbbra is elérhető termékeihez tartozó** események láthatók (gördülő időablak, az esemény `occurred_at` időpontjától számítva). Pontosan 24 órás kor elérésekor az esemény kiesik a listák lekérdezéséből; ismételt, változatlan webshopvizsgálat nem hosszabbítja meg ezt. A tárolt eseményadat megmarad deduplikációhoz/előzményhez; az **Elérhető termékek** listát az időkorlát nem érinti. A továbbra is elérhető régi termék így csak ott látszik; valódi új visszakészletezés új 24 órás megjelenést indít. Mindkét változáslista már az első elfogadott teljes vizsgálatból megállapított hiány után elrejti a terméket (`in_stock=1`, `missing_count=0`, aktuális epizód szükséges); hibás/hiányos vagy megerősítésre váró nagy készletcsökkenés nem töröl kártyát. A szűrés mindkét helyen a darablimit előtt történik, admin és reader esetén azonosan. A Pokémon-oldali APK-letöltés a webshopok **alá**, a lábléc elé került.

Az oldalsávból elérhető a Hírolvasó és a Konfig; a főoldali gyorslinkek fejlécéből közvetlenül a linkbeállításokhoz lehet jutni. Az RSS- és linkmódosítások a kapcsolódó új útvonalakat is újraérvényesítik. A főoldal betöltése többé nem vár RSS-hálózati frissítésre; az a Hírolvasó megnyitásakor/a Frissítés gombbal történik, a meglévő 15 perces gyorsítótárral. Ehhez a webes frissítéshez Android APK-frissítés nem szükséges.

Admin főmenü sorrendje: **Dashboard → Hírolvasó → Pénzügy → Jegyzetek / teendők → Pokémon figyelő → Konfig**. A tulajdonosnak a Pokémon és Konfig között külön **OpenCode** menüpont is megjelenik. A reader menüje továbbra is kizárólag Pokémon.

## Pokémon worker és push

Az Android-app 1.0.2-ben az aktuális oldal tetején lefelé húzva frissíthető a WebView. Ehhez az APK frissítése szükséges; a meglévő appra telepítsd, eltávolítás és újrapárosítás nélkül. A külön `/notes` weboldal automatikusan elérhető a régi appban is.

Android WebView-app és Firebase push: `android/`, használat/fordítás/biztonság: `docs/android-app.md`. Saját fiókkal böngészőben jóváhagyott telefonpárosítás, **Konfig / Telefonok / push** eszközkezelés, FCM HTTP v1 outbox a meglévő workerben. **Az értesítés kizárólag push; az e-mail/SMTP funkció eltávolítva.** Követi a webshop új/visszakészletezés/előrendelés beállításait; baseline és régi esemény nem generál értesítést. Szerverkulcs csak védett helyi fájlban, nem APK-ban. Telefonon értesítési engedély és Play-szolgáltatások szükségesek. A natív app 1.0.1 sötét fejléce a webes palettát használja; a frissítés megtartja a telefonpárosítást.

Telepítés/frissítés rendszergazdai PowerShellből: `scripts/Install-Pokemon-Worker.ps1`. Kizárólag a `WydrianPokemon` szolgáltatást kezeli, automatikus indulással, LocalService fiókkal; nem nyit portot és nem változtat a médiaszolgáltatásokon. Verziózott kódmásolatot készít a `.runtime/pokemon` alatt, hogy a forráskód szerkesztése ne befolyásolja a futó workert. A dashboardfrissítés és a workerfrissítés együtt a `scripts/Deploy-Pokemon.ps1` scriptből indítható, sikeres `.next-staging` build után. Naplók: `logs/WydrianPokemon.*.log`. A szolgáltatások egymástól függetlenek.

```powershell
Get-Service WydrianPokemon
Restart-Service WydrianPokemon
```

A worker nem függ a böngészőtől vagy dashboard-látogatástól. SQLite-tárolt esedékesség és kizárólagos lease, WAL + busy_timeout. A kézi gomb a workernek ütemez munkát, csak admin használhatja. A `/api/pokemon` minden aktív szerepkörrel olvasható; közös figyelést és gyakoriságot csak admin állíthat, saját push kapcsolóját a reader is mentheti. Nagy listacsökkenés újabb teljes vizsgálatra vár, egy termék hiányát két sikeres scan igazolja. A régi termékkulcsok megmaradnak, részletes scan-naplók 90 napig. A UI az utolsó ismert termékállapotot mutatja, hiány-megerősítés alatt külön címkével.

A worker telepítője a LocalService fiókot külön `sc.exe config` hívással is beállítja és ellenőrzi; WinSW-nél a régi `<username>` mező önmagában nem állította át a Windows-fiókot. A Node realpath feloldásához a projekt szülőmappáin csak attribútumolvasás/áthaladás jogosultságot ad, könyvtárlistázást vagy örökölt hozzáférést más fájlokhoz nem. Telepítési napló: `logs/pokemon-installation.log`. Ellenőrzés: `Get-CimInstance Win32_Service -Filter "Name='WydrianPokemon'" | Select-Object Name,StartName,State`. A régebbi dashboard/HTTPS telepítés fiókját ez a script nem módosítja; azok tényleges Windows-fiókját külön kell ellenőrizni, nem az XML-ből következtetni rá.

Push konfiguráció: `POKEMON_FCM_CREDENTIALS` és `POKEMON_PUSH_ENABLED`, részletek a mobilapp dokumentációjában. Teszt push az app menüjéből kérhető, eszközönként ötpercenként; az admin **Konfig / Telefonok / push** részén a küldési állapot is megtekinthető. Az értesítési kapcsolók felhasználó és webshop szerint külön tárolódnak: saját mentés csak saját telefonok adott webshophoz tartozó várakozó pushait törli. Admin saját új/visszakészletezés/előrendelés választása nem hat a readerekre; a reader csak saját webshoponkénti fogadást kapcsolhat. A közös figyelés szüneteltetése természetesen mindenkinél leállítja az adott shop vizsgálatát. A már folyamatban levő küldés nem vonható vissza; bizonytalan beküldést nem ismétlünk automatikusan.

A korábbi levélküldési táblák, oszlopok és előzmények kompatibilitási/archiválási okból megmaradtak. Egyszeri migráció kikapcsolja a régi email-flageket és törlés nélkül `cancelled` állapotba helyezi a még várakozó leveleket. Nincs SMTP-sender, tesztlevél-akció, levélsorba állítás vagy e-mail felületi kapcsoló; SMTP env változók többé nem indítanak levélküldést. Az API régi `smtpConfigured` mezője mindig false, a `mail` lista üres. Webshopadapterek, baseline-ok, Google-belépés és a telefonpárosítás változatlanok.

Futó adatbázis konzisztens mentése: helyi Node-dal `scripts/Backup-Database.mjs`. Teljes fájlmásolatos mentéshez a dashboard mellett a Pokémon workert is állítsd le. A worker telepítője is adatbázismentést készít.

Napi titkosított, próba-visszaállítással ellenőrzött mentés és opcionális, ellenőrzött Google Drive-feltöltés: [docs/backups.md](docs/backups.md). Ütemezett feladat: `WydrianDailyBackup`, 03:00, `D:\!nas`, 30 napos megőrzés. A felhős feltöltés csak befejezett Google OAuth-kapcsolat után aktív. A `recovery-key.json` fájlt kötelező külön, offline is megőrizni.
