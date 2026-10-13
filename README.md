# Wydrian Dashboard

Privát, Windows-alapú NAS-munkaterület: rendszeráttekintés, pénzügyek, gyűjtemények, fájlmegosztás, jegyzetek és Pokémon-készletfigyelés egy közös webes felületen és Android-appban.

**Web:** 1.4.6 · **Android:** 1.1.4 · **Technológia:** Next.js / React / TypeScript, Auth.js, Node.js 24, SQLite, Caddy, Firebase Cloud Messaging.

- Dashboard: **[wydrian.hu](https://wydrian.hu)** és **[nas.wydrian.hu](https://nas.wydrian.hu)** — ugyanaz az alkalmazás és adatbázis, külön böngészős munkamenettel.
- Fejlődéstörténet: **[GitHub Pages](https://wydrian1.github.io/nas_dashboard/)** — önálló, magyar bemutató; a NAS nem szolgál ki `/timeline` oldalt vagy átirányítást.
- Aktív szerverkönyvtár: `D:\!nas`. A repository a forrást tartalmazza, **nem** az éles adatokat, kulcsokat vagy mentéseket.

## Mit tud?

| Felület | Tartalom | Hozzáférés |
| --- | --- | --- |
| **Dashboard** · `/` | Kompakt, lenyitható kereső, NAS-szolgáltatások állapota, gyorslinkek, saját település időjárása, CPU/RAM/meghajtók | Admin |
| **Hírolvasó** · `/news` | RSS/Atom-források, képes hírek, olvasott/olvasatlan állapot, kézi frissítés | Admin |
| **Pénzügy** · `/finance` | Havi vagyonállapotok, előzmények, összetétel, nominális és reálgyarapodás, kézi havi rögzítés | Admin |
| **Gyűjtemények** · `/collections` | LEGO- és Pokémon-bekerülési tételek, darabszám, ár, beszerzési dátum | Admin |
| **Fájlok** · `/files` | Mappák, többfájlos feltöltés, letöltés, megosztási linkek, megerősített fájltörlés | Admin |
| **Jegyzetek / teendők** · `/notes` | Közös adminjegyzetek, saját feladatok és határidők | Admin |
| **Pokémon figyelő** · `/pokemon` | 15 webshop készlete, keresés/szűrők, új és visszakészletezett termékek | Admin, Pokémon-olvasó |
| **Értesítési központ** · `/config#notifications` | Saját figyelőlista, pushszabályok, csendes idő, összefoglaló és küldési előzmény | Admin; Pokémon-olvasónak `/notifications` |
| **Fontos infók** · `/important-info` | Közös formázott tájékoztató és a legfrissebb mentett pénzügyi állapot kijelölt adatai | Admin szerkeszti; infóolvasó olvassa |
| **Keresés** · `/#dashboard-search` | Szerepkör szerint elérhető modulok közös keresője, külön menüpont nélkül; admin régi `/search` címe ide irányít | Admin; olvasóknak a jogosultságszűrt `/search` továbbra is elérhető |
| **Rendszer állapota** · `/system` | Worker, webshopok, mentési bizonyítékok, APK, kiadás és pushállapotok | Csak tulajdonos |
| **OpenCode** · `/opencode` | Az eredeti OpenCode webfelülete védett átjárón keresztül | Csak tulajdonos |
| **Konfig** · `/config` | Gyorslinkek, RSS, felhasználók, telefonok/push; tulajdonosi restart-helper | Admin; helper csak tulajdonos |

Az oldalszakaszok sorrendje böngészőnként menthető. Az átrendező vezérlők alapból rejtettek; csak külön bekapcsolás után jelennek meg. A webes felület asztali és keskeny Android-nézetre is készül.

### Pénzügy és gyűjtemények

A mentett havi tényadat és az aktuális piaci becslés külön szerepel. Collectr, BrickEconomy, ECB/Frankfurter árfolyam és KSH-infláció segíti az előtöltést és összehasonlítást; az opcionális eToro-integráció csak a teljes egyenleget olvassa. **Oldalmegnyitás vagy külső lekérés nem ment automatikusan havi adatot.**

Új hónapnál csak a kijelölt Lili/Bali DEBT-mezők öröklődnek. A kapcsolódó piaci mezők ellenőrzött forrásból indulnak, a többi üresen marad. Forráshibánál nincs kitalált ár vagy bekerülési összeggel helyettesített piaci érték.

A gyűjteménykártyák a mentett és piaci gyarapodást mutatják, külön „Nyilvántartási adatminőség” panel nélkül. Az ismeretlen beszerzési dátumhoz használt számítási feltételezés és a piaci adat frissessége továbbra is látható; a tárolt dátumok és havi összegek nem változnak. A diagramok SVG-címei egyező szerver- és kliensszöveggel jelennek meg.

Részletek: [Pénzügy](docs/finance.md), [Gyűjtemények](docs/collections.md).

### Pokémon-készletfigyelés

**GameRunner · MythGames · Pöttyös Zebra · GrandLine · Krodom Cards · JátékNet · Reflexshop · GeekEmpire · TCG Futár · Sport Kártya Bolt · RT Collectors Club · Cardverse · Metagames · TCG Bolt · Bloomrift.**

- A külön `WydrianPokemon` worker böngésző és oldalmegnyitás nélkül működik. Alapintervallum **3 perc**, admin által **3–60 perc** között állítható; a robots-késleltetés, soros feldolgozás és hibavárakozás miatt ez nem garantált 180 másodperces falióra-ütem.
- Az adapterek csak előre engedélyezett útvonalakat olvasnak, a robots.txt szabályait betartva. Teljes listát és igazolt lapozást fogadnak el; hibás/hiányos vizsgálat nem írja felül a korábbi állapotot.
- Az elérhetőség boltonként igazolt kosárgomb vagy a dokumentált készletszűrt lista alapján dől el. Előrendelést nem következtetünk pusztán a terméknévből. Az első teljes baseline csendes; nincs visszamenőleges push.
- Egy termék elfogyását két sikeres hiányzó vizsgálat igazolja; nagy készletcsökkenés újabb teljes ellenőrzésre vár. A változáslisták csak az elmúlt **24 óra továbbra is elérhető** termékeinek aktuális eseményeit mutatják; a tárolt előzmény megmarad.
- Sikertelen, szüneteltetett vagy elavult vizsgálatnál a felület **utolsó ismert / elavult készletadatot** jelöl, nem friss készletet. HTTP 403, 429, ismert karbantartás és technikai hiba külön kategória; hozzáférésvédelmet nem kerül meg.
- A Bloomrift angol kategóriáját teljes lapozással ellenőrzi. A privát kulcsfájllal hitelesített katalógust is olvas; lejárt/sikertelen belépést nem ment hiányzó készletként. Nyilvános, belépéshez kötött kártyát csak kifejezett **Nincs raktáron** állapot esetén tekint nem elérhetőnek.

Boltonkénti szabályok: [webshopdokumentációk](docs/pokemon-shops/), [Bloomrift hitelesítés](docs/pokemon-shops/bloomrift.md), [frissesség és személyes eszközök](docs/reliability-and-tools.md).

### Android és értesítések

Az Android-app a védett webes modulokat jeleníti meg, Google-belépéssel jóváhagyott telefonpárosítással és Firebase pushsal. A **Konfig → Telefonok / push** kezeli az eszközöket; a régi `/mobile` admincím ide irányít. Nincs SMTP vagy e-mail-értesítés.

Az értesítések személyesek: a fiók webshopkapcsolói és az adott telefon engedélye egyaránt számítanak. Adminoknál az Értesítési központ a Konfig saját szekciója, nem külön főmenüpont; a régi `/notifications` cím ide irányít. A Pokémon-olvasóknak külön saját oldal marad, admin Konfig-hozzáférés nélkül. Alapból azonnali termékpush működik; a figyelőlista-szűrés, Budapest-idő szerinti csendes idő és 5/10 perces összefoglaló **külön bekapcsolható**. Csendes idő után nincs visszamenőleges készletküldés. Az FCM által elfogadott üzenet nem bizonyítja a telefonos megjelenést; bizonytalan beküldést nem ismétlünk automatikusan.

A határidős teendők a létrehozó saját telefonjára kérnek emlékeztetőt. Az appfrissítő ellenőrzi a publikált APK méretét, hashét, verzióját és aláírását; a telepítést az Android rendszerablaka hagyja jóvá, nem néma telepítés. Az 1.1.4 app dinamikus webshop-hostlistát használ; egy web/worker javítás önmagában nem igényel új APK-t vagy újrapárosítást.

Részletek: [Android-app](docs/android-app.md), [határidők és frissítések](docs/deadlines-and-app-updates.md), [személyes szabályok](docs/reliability-and-tools.md).

### Fájlmegosztás

Legfeljebb **1 GB/fájl**, streamelt feltöltés, haladásjelző és megszakítás. A tartalom dedikált, nem publikus tárolóban van; a kész fájlhoz állandó vagy lejáró, visszavonható aláírt link készülhet. **A link birtokosa bejelentkezés nélkül letölthet** — csak megbízható címzettnek add át.

A megerősített fájltörlés az adott fájlt és minden megosztását eltávolítja; más fájlhoz nem nyúl. A már letöltött másolat nem vonható vissza. Nincs automatikus vírusellenőrzés vagy teljes NAS-fájlböngésző.

Részletek: [Fájlhosting](docs/file-hosting.md), [Fájltörlés](docs/file-deletion.md).

## Belépés és jogosultságok

Nincs nyílt regisztráció. Csak engedélyezett, Google által igazolt fiók léphet be; a tényleges szerepkört minden kérésnél a szerver ellenőrzi.

- **Tulajdonos:** az `ALLOWED_EMAIL` által kijelölt, nem letiltható bootstrap-admin. A rendszerállapot, OpenCode és restart-helper tulajdonosi funkció.
- **Admin:** kezeli a közös modulokat és felhasználókat; a saját teendőket és értesítéseket nem keveri más fiókéval.
- **`pokemon-reader`:** készletfigyelő, saját értesítési központ és ezekre korlátozott keresés.
- **`info-reader`:** Fontos infók és az arra korlátozott keresés; nem kap teljes pénzügyi előzményt vagy Pokémon-hozzáférést.

A readerek saját app-párosítása és frissítése technikai kivétel, nem adminjog. A menü elrejtése nem helyettesíti az oldal/API/szerverakció jogosultságellenőrzését. Részletek: [Szerepkörök](docs/roles.md), [Fontos infók](docs/important-info.md).

## Fejlesztői indítás

Új, elkülönített munkakönyvtárban, **Node.js 24** használatával:

```powershell
npm ci
Copy-Item .env.example .env.local
# Töltsd ki helyben az OAuth-adatokat, az AUTH_SECRET-et és az ALLOWED_EMAIL-t.
npm run dev
```

Helyi cím: `http://localhost:3000`. A Google OAuth-kliensben engedélyezendő callback: `http://localhost:3000/api/auth/callback/google`. Nincs fejlesztői belépés-bypass. Az alkalmazás loopbackre köt; **a 3000-es portot nem szabad publikusan megnyitni**.

Éles környezetben a két domainhez `AUTH_MULTI_DOMAIN=true`, rögzített HTTPS callbackek és eltávolított `AUTH_URL` / `NEXTAUTH_URL` szükséges. A Caddy kezeli a publikus HTTPS-t; az apex ZeroSSL ACME-megújítása a megfelelő DNS, HTTP-01 elérhetőség és megőrzött TLS-tár függvénye. Konfiguráció: [.env.example](.env.example), [két domain és TLS](docs/apex-domain.md).

## Ellenőrzés és kiadás

Forrásmódosítás után, külön munkakönyvtárban:

```powershell
npm test
npm run typecheck
$env:DASHBOARD_BUILD_DIR = '.next-staging'
npm run build
npm run test:browser
node --test docs/history-site.test.mjs
```

A staging build nem írja felül az élő `.next` könyvtárat. A böngészőteszt külön buildmásolatot, szintetikus SQLite-adatokat és loopback szervert használ; nem hoz létre éles tesztfiókot/eszközt, és runtime cache-e nem szennyezi a publikálandó buildet.

`npm run check:release` tiszta, commitolt forrásarchívumból saját függőségekkel futtatja a kiadási ellenőrzéseket. A GitHub Actions tesztel, buildel és titokszivárgást ellenőriz; **nem telepít automatikusan a NAS-ra**.

Minden módosítás külön task branch és `main` célú PR útján kerül GitHubra. A merge és az élesítés külön jóváhagyott lépés; teszt vagy buildhiba mellett nincs kiadás. Részletek: [munkamegállapodás](AGENTS.md), [tesztelés](docs/testing.md).

## Üzemeltetés, mentés és helyreállítás

| Komponens | Feladat |
| --- | --- |
| `WydrianDashboard` | Webalkalmazás; dedikált nem-admin szolgáltatásfiók |
| `WydrianHttps` | Caddy reverse proxy és TLS |
| `WydrianPokemon` | Készletfigyelés, határidős emlékeztetők és push; LocalService, immutable kódkiadás |
| `WydrianDeployer` | Ellenőrzött web/worker/APK csomagok korlátozott élesítése |
| `WydrianDailyBackup` | Napi 03:00 Budapest-idő szerinti titkosított mentés, 30 napos megőrzés |

A jóváhagyott kiadás a [delegált élesítési folyamatot](docs/delegated-deployment.md) használja: pontos commit, elkülönített ellenőrzés, hash-elt csomag, konzisztens SQLite-mentés, érintett komponensek cseréje és utóellenőrzés. A régi web/worker/APK visszaállítható; hibánál **nem állítunk vakon vissza teljes adatbázist**. Nem építünk az élő `.next` fölé, és nem indítjuk újra az OpenCode-ot vagy a médiaszolgáltatásokat egy dashboardfrissítés miatt.

## NULLPONT

A [NULLPONT kalandjáték](apps/nullpont/README.md) önállóan telepíthető alkalmazás,
dashboard-belépést átvevő saját munkamenettel, adatbázissal és kiadási csomaggal.
Új Google OAuth-kliens nem kell. A dashboard `NULLPONT_URL` hivatkozást és
egyszer használható, PKCE-hez kötött belépésátadást biztosít; nem futtat játékmotort. A régi játékállások
adatmegőrző importtal átvihetők. [Leválasztási és történeti megállapodás](docs/nullpont-adventure.md).

A napi mentés online SQLite-pillanatképet és védett fájlokat archivál, AES-256-GCM titkosítással és próba-visszaállítással. Az engedélyezett Google Drive-feltöltés csak titkosított archívumot küld, visszaolvasott hash-ellenőrzéssel. A `/system` kizárólag olvasható, érvényes mentési bizonyítékot minősít sikernek; hiányzó vagy olvashatatlan későbbi státusz nem zöld állapot.

**A recovery-kulcs és a kulcs nélküli helyreállító készlet külön, szerveren kívüli példányban is szükséges.** A RAID nem backup. Helyreállítás csak új célmappába történhet; futó SQLite-ból nem elegendő a fő `.sqlite` fájlt lemásolni. A hosting tartalma és adatbázis-metaadata együtt mentendő.

Privát marad: `.env.local`, `data/`, `.runtime/`, `cert/`, naplók, OAuth/Firebase/webshop-credentialok, rclone-konfiguráció, SQLite-adatok, Android-aláírókulcsok és titkosított archívumok. Ezek nem kerülhetnek commitba, PR-ba, publikus artifactba vagy diagnosztikai kimenetbe. Új kulcsfájlhoz csak a szükséges szolgáltatás kapjon célzott hozzáférést, ne teljes privát könyvtár-olvasást.

További üzemeltetési útmutatók: [Mentés](docs/backups.md) · [Katasztrófa utáni helyreállítás](docs/disaster-recovery.md) · [OpenCode](docs/opencode.md) · [Restart-helper](docs/admin-helper.md) · [Projektköltöztetés](docs/project-move.md) · [Szekciósorrend](docs/section-order.md) · [GitHub Pages bemutató](docs/timeline.md).
