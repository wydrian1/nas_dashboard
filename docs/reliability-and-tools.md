# Megbízhatóság és személyes eszközök

## Felületek és hozzáférés

- `/system`: csak a tulajdonosnak; háttérfigyelő-életjel, boltok, mentési bizonyítékok, publikált APK, kiadási bejegyzés, napi pushállapotok és a meglévő olvasási szolgáltatáspróbák. `/api/operations` ugyanígy tulajdonosi, `no-store`; a korábbi `/api/system` rendszererőforrás-API változatlan.
- `/config#notifications`: adminok saját böngésző-push feliratkozása, beállításai, személyes figyelőlistája és legutóbbi 100 eszközönkénti küldési bejegyzése, a Konfig részeként. A régi `/notifications` admincím ide irányít; Pokémon-olvasónak ugyanaz a saját felület külön `/notifications` oldalon marad, Konfig-hozzáférés nélkül. Más fiók adatai, FCM-token, párosítási titok és nyers payload nem kerül a válaszba.
- `/#dashboard-search`: adminok kompakt, alapból csukott keresője a Dashboardon; találatos lekérdezésnél kinyílik. Natív `details` és GET-űrlap, JavaScript nélkül is használható; üres oldalon nincs keresési adatbázis-lekérdezés. Nincs külön balmenüpont. A régi admin `/search?q=…` cím megőrzi a keresést és ide irányít; az olvasói `/search` bejelentkezés után továbbra is használható. A tényleges adatbázis-szerepkör korlátozza a modulokat. Admin: jegyzetek, saját teendők, kész fájlok neve, aktív gyűjteménytételek neve, fontos infók, készletfigyelő. Pokémon-olvasó: készletfigyelő. Infóolvasó: fontos infók. Nincs fájltartalom-, titok- vagy megosztásitoken-keresés. A LIKE-helyettesítő karakterek literálisak; legfeljebb 50 találat, modulonként 10.

## Készletfrissesség

A mentett terméklista megmarad sikertelen vizsgálatnál, de **utolsó ismert**, nem aktuális állapotként jelenik meg. Elavultnak számít: hiányzó/4 percnél régebbi worker-életjel, szüneteltetés, hiányzó vagy nem hiteles sikeridő, megerősítésre váró vizsgálat, hibaszámláló, illetve az utolsó siker óta eltelt `max(15 perc, 3 × boltintervallum)`.

A közös számláló külön mutatja a friss és az elavult termékeket; a közös események is kapnak frissességjelzést. GrandLine ismert hozzáférésvédelmi és Krodom ismert karbantartási átirányítása megállítja a letöltést, nem tágítja a megengedett útvonalakat. HTTP 403: hozzáférésvédelem, 429: terhelési korlát; egyéb hiba technikai marad. Nincs védelmi megkerülés. Az exponenciális visszalépés és Retry-After megmarad, védett/karbantartott boltnál legalább 15 perc a próbák között.

## Értesítések: minden új szabály opt-in

Az új táblák hozzáadó migrációval jönnek létre. Meglévő eszköz, párosítás, boltintervallum, felhasználó, pushkapcsoló és gyűjteménytétel nem változik. Alapból azonnali termékpush, kikapcsolt csendes időszak és kikapcsolt figyelőlista-szűrés marad.

- Egy figyelőszabály feltételei együtt szükségesek; több szabály közül egy találat elég. Névrészlet, bolt, névben jelölt angol/japán nyelv és Ft-árhatár választható. Ismeretlen ár/nyelv nem teljesíti az adott szűrőt; nincs találgatás. Legfeljebb 30 szabály/fiók.
- Csendes idő: Budapest, nyári/téli időszámítással. Az ebben az időben érkező vagy küldésre kerülő termékpush `muted`; nincs reggeli visszamenőleges készletküldés. A feladat-, teszt- és kiadásértesítések változatlanok.
- 5/10 perces összefoglaló: a következő időablakhatárig vár, eszközönként legfeljebb 20 jogosult eseményt von össze. Megtartja a 15 perces lejáratot; Androidon a meglévő `/pokemon` navigációt, böngészőben a helyi service worker értesítést használja, nincs APK-módosítás.
- Közvetlenül FCM-küldés előtt ismét ellenőrzi az eszközt, szerepkört, eseményenkénti szűrést és csendes időt. Bizonytalan beküldés minden összefoglalótagot `uncertain` állapotba tesz, automatikus újraküldés nélkül.
- Személyes szabálymódosítás a saját várakozó termékpushokat törli, nincs visszamenőleges újraküldés; más felhasználó és más értesítéstípus nem változik.
- `sent` = az FCM elfogadta, **nem** telefonos megjelenítés vagy megnyitás igazolása. A tulajdonos a valódi telefonos ellenőrzést nem kérte.

## Mentési bizonyíték és értékbecslés

A nézet a meglévő `.runtime/automatic-backups/status.json`, a hozzá tartozó nyugta és a `Test-CloudBackup.ts` által előállított `.runtime/research/cloud-backup-restore-verified.json` eredményéből csak a szükséges időpontokat/állapotot olvassa. Hiányzó, olvashatatlan, eltérő archívumhoz tartozó vagy jövőbeli adat nem siker. Mentés/felhőellenőrzés: 36 óra; teljes, hash-, hitelesített visszafejtés-, fájlmanifest- és SQLite-ellenőrzött recovery kit próba: 30 nap. Nem olvas helyreállítási kulcsot, nem indít mentést, és nem változtat ACL-t. A későbbi élesítés előtt a szolgáltatásfiók olvasási hozzáférését külön ellenőrizni kell; hiánya a felületen „nem ellenőrizhető”, nem zöld állapot.

A mentésírók minden státusz-/nyugta-/visszaállításijelentés-csere előtt csak az új JSON-fájlra adják meg a dashboard dedikált szolgáltatásának olvasási jogát; a szülőmappán kizárólag nem öröklődő áthaladás szükséges. Nincs archívum-, kulcs- vagy teljes könyvtár-olvasás. Korábbi metaadatok egyszeri javítására külön operátori `Repair-BackupEvidenceAccess.ts` script szolgál, nem az állapotlekérő API. [Részletek](backups.md#dashboard-csak-az-állapotbizonyíték-olvasása).

A pénzügyi gyarapodás a mentett havi értéket és az aktuális piaci becslést külön mutatja, külön „Nyilvántartási adatminőség” panel nélkül. A számításhoz szükséges ismeretlendátum-feltételezés továbbra is látható az érintett összehasonlításnál. A piaci lekérés 24 óra után elavult. Az SSR és kliens azonos szerveroldali `checkedAt` időpontot használ. Nem változik mentett havi érték, beszerzési dátum, bekerülés vagy a meglévő reálgyarapodási feltételezés. Nincs új import vagy külső gyűjteményegyeztetés.

## Elkülönített ellenőrzés és CI

`npm run check:release` tiszta, commitolt forrásból `git archive` segítségével önálló munkaterületet hoz létre `.runtime/verification/` alatt. Saját `npm ci --ignore-scripts` telepítés, majd:

1. `npm test`
2. `node --test docs/history-site.test.mjs`
3. `DASHBOARD_BUILD_DIR=.next-staging npm run build`
4. `npm run typecheck`
5. `npm run test:browser` (a script közvetlen futtatásával)

A gyökér `.next`, generált deklarációk és élő adatbázis nem kellenek ehhez, és nem módosulnak. A forrás-HEAD és tisztaság ismét ellenőrzésre kerül a végén. A böngészőteszt a build külön másolatával, ideiglenes szintetikus SQLite-adatbázissal és loopback szerverrel fut: a teszt által létrehozott runtime route-cache nem kerül a csomagolandó buildbe. Blokkolja a külső böngészőkéréseket, és valódi szerverakciókat, szerepkörhatárokat, feltöltött pénzügyi grafikonok hibamentes hidratációját és 1440/390/320 pixeles elrendezést ellenőriz. Az elszigetelt munkaterület és eredményfájl megmarad ellenőrizhető bizonyítéknak.

A `Prepare-Deployment.mjs` ezt az ellenőrzött buildet csomagolja a régi helybeni építés helyett; a két meglévő olvasási ACL-preflight megmarad. Éles buildhez a privát `.env.local` csak folyamatkörnyezetként kerül az izolált buildbe, nem a forrásarchívumba.

GitHub Actions: PR/main teszt, build, típusellenőrzés és böngészőteszt; külön teljes Git-történet Gitleaks-ellenőrzés, teljesen maszkolt találatokkal. Actions commit-hash és Gitleaks archívum-SHA256 rögzített; csak `contents: read`, nincs deploy vagy production-titok a CI-ben. A CI nem helyettesíti a külön merge/élesítési engedélyt.
