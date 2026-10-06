# Delegált élesítés, általános adminjog nélkül

Tulajdonosi felhatalmazás: web + Pokémon-worker + meglévő kulccsal aláírt Android-APK publikálása, a beszélgetésben kért változtatásokhoz külön Windows-jóváhagyás nélkül. GitHub-merge továbbra is külön engedélyes; nem automatikus telepítés minden commit után.

## Jogosultsági határ

- Külön **`NT SERVICE\WydrianDeployer`** nem-admin szolgáltatás; nincs SYSTEM, admin-csoport, impersonation vagy debug jog. Csak `SeChangeNotifyPrivilege`.
- A dashboard SYSTEM helyett **`NT SERVICE\WydrianDashboard`** alatt fut, szintén csak traversal privilégiummal. A worker marad LocalService. A broker minden művelet előtt ellenőrzi a két cél fiókját/binárisútját; más vagy SYSTEM fiók esetén elutasít.
- SCM-jogok kizárólag a dashboard/worker célra: `QUERY_CONFIG | QUERY_STATUS | START | STOP` (**0x35**). Nincs ChangeConfig/Delete/WRITE_DAC/WRITE_OWNER. A query-config jog csak a nem-admin fiók ellenőrzésére kell. HTTPS, helper, OpenCode gateway és eredeti OpenCode érintetlen.
- Program Files alatt védett, SYSTEM-tulajdonú natív bináris/config és rögzített Node/SQLite-, Java/apksigner-, aapt-verifikátorok. A broker ezeket nem írhatja át. Nem futtat PowerShellt, cmd-t, tetszőleges szkriptet, parancsot vagy kérésben megadott executable-t.
- Csak `.next`/saját kiadási könyvtárak, az egyetlen worker-XML és APK-alias módosítható. Az élesítő nem kap OAuth/eToro/Firebase/aláíró-/recovery-kulcs olvasást. A dashboard csak a működéséhez szükséges SQLite/cache/log és kiválasztott credential jogokat kapja; a régi restart-helper továbbra is tulajdonosi megerősítést kér.

## Működés

1. Normál felhasználóként `node --experimental-strip-types scripts/Prepare-Deployment.mjs --web --worker --apk` (csak a ténylegesen változó komponensek kapcsolóit add meg). Tiszta, commitolt forrás kell. Teljes tesztek/typecheck/staging production build, APK-nál Android-tesztek/lint/signature build. A generált `next-env.d.ts` helyreállítása után futnak a tesztek. Nincs automatikus publikálás.
2. A kimeneti csomag-ID-val `node --experimental-strip-types scripts/Request-Deployment.mjs <id>`. Nincs UAC. A kliens a privát, helyi delegálási kulccsal aláírja az ID/időpont/manifest-hash hármast, és hitelesített eredményre vár. A kulcs nem kerül webre, appba vagy Gitbe.
3. A broker legfeljebb 15 perces, pontos mezőkészletű kérelmet fogad el egyszer. Egy művelet fut egyszerre. Whitelistelt relatív fájlutak, kötelező check-attesztáció, teljes méret/hash, reparse/hardlink/final-handle-path ellenőrzés. Saját, operátor által nem írható kiadási másolatból aktivál. Az APK-nál önálló aláírás-, pinned signer-, package- és monoton versionCode-ellenőrzés.
4. Konzisztens, integrity/FK-ellenőrzött SQLite-mentés, korábbi build/worker-XML/APK megőrzése. Csak érintett dashboard/worker stop/start, localhost web-health és friss worker-heartbeat. Hibánál komponensrollback, **soha nem teljes adatbázis-visszaállítás**.
5. Flush-olt audit/állapot és HMAC-os eredmény. Félbeszakadt munka `uncertain`, soha nem fut újra automatikusan. 500 job vagy 16 MiB havi audit fölött admin-karbantartás kell; nincs automatikus előzménytörlés. A buildküldő teszt-attesztációja bizalmi határ: a delegált helyi operátor forráskódot telepíthet, a broker nem bizonyítja függetlenül, hogy a tesztek lefutottak. Ez nem teljes helyi támadó elleni Windows-sandbox.

### APK és hibás élesítés helyreállítása

Az APK-publikálás az élesítő saját, dashboard által olvasható kiadásából **ugyanazon köteten, atomi `MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)` átnevezést** használ. Nem másol át kötetek között, és nem próbálja meg a régi fájl tulajdonosi/ACL/stream-metaadatait a `ReplaceFile` API-val összeolvasztani. A kész fájl a védett kiadás jogosultságait tartja meg; nincs új adminjog, szélesebb artifact-jog vagy nem-atomi felülírás. Megosztási zárolás esetén a régi APK érintetlen marad.

Induláskor a **tényleges nem-admin szolgáltatásfiók** saját, elkülönített fájlokon publikálási próbát végez: mindkét fájlon tiltott ACL/tulajdonos-módosítás, szűk célkönyvtár-jogok, zárolt cél elutasítása és sikeres atomi csere. A próba nem érinti az éles APK-t vagy szolgáltatásokat; hiba esetén az élesítő el sem indul. Az eredmény hitelesített `results/publisher-preflight.json`.

A rollback minden komponenst külön próbál helyreállítani. APK-, marker-, audit- vagy más szolgáltatáshiba **nem hagyja ki** a többi biztonságosan visszaállított szolgáltatás újraindítását. A dashboard csak az ellenőrzött korábbi build-ID, a worker csak a korábbi XML-hash egyezése esetén indulhat újra; nem indul vakon az új, hibás kiadás. Eredményben az eredeti hibafázis, hibakategória, Windows/HRESULT hibakód és a sikertelen rollback-lépések szerepelnek, nem nyers exception-szöveg vagy titok. Hiányos helyreállítás továbbra is `uncertain`, automatikus újrapróbálás nélkül.

## Egyszeri telepítés / visszavonás

`scripts/Test-Deployer.ps1`, teljes `npm test`, typecheck, `.next-staging` production build; majd egyszeri tulajdonosi UAC-val `scripts/Install-Deployer.ps1 -ExpectedBinarySha256 <tesztelt hash>`. Nem ír felül meglévő broker-telepítést. Mentés után a dashboard fiókját átállítja és a jelenlegi éles buildet indítja újra; más szolgáltatás nem indul újra. Telepítési hiba esetén korábbi dashboard-fiók/XML visszaállítása és broker letiltása; csak saját ACL-grant eltávolítás, nincs más adminváltozás visszavonása.

Visszavonás: emelt PowerShellben `Stop-Service WydrianDeployer; Set-Service WydrianDeployer -StartupType Disabled`. Ez nem állítja vissza a dashboardot SYSTEM-re. Elveszett/kiszivárgott klienskulcs esetén letiltás és külön, ellenőrzött kulcsrotáció kell.

A napi titkosított mentés a broker védett bináris/config/állapot/audit anyagát `.runtime/deployer-recovery` alá és a klienskulcsot privátként archiválja; Node/Java/verifikátor runtime nem duplikálódik. Restore semmit nem telepít Program Filesba vagy Windows-szolgáltatásként: új gépen egyszeri UAC-s telepítés és új ACL-ek szükségesek. A meglévő SQLite/schema-migrációk nem általánosan visszafelé kompatibilisek; élesítést megelőző teszt/mentés és utólagos funkcióellenőrzés továbbra is kötelező.
