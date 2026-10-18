# Wydrian NAS Android-app

Projekt: `android/`, Java, natív Android Activity + WebView. Android 8.0 (API 26) vagy újabb, Firebase-projekt `nas-wydrian-hu`, csomagnév `hu.wydrian.nas`. Google Play-szolgáltatások és működő internet szükséges az FCM pushhoz. APK terjesztés privát telepítéssel; nincs Play Áruház-publikálás.

## Első indítás

1. Android 13+ értesítési engedély. Elutasítás nem tiltja a dashboard használatát.
2. „Google-belépés böngészőben”: az app létrehoz egy 5 percig érvényes SHA256-kihívással védett párosítást, és a **rendszer böngészőjében** nyitja a `/mobile/connect` oldalt.
3. Saját, előre engedélyezett és Google által igazolt `admin` vagy `pokemon-reader` fiók, Auth.js Google-belépéssel. A telefon és a böngésző 8 karakteres kódja egyezzen; a felhasználó kifejezetten jóváhagyja saját telefonját. Ne hagyj jóvá más által küldött párosítási linket. Role-kezelés: `docs/roles.md`.
4. Visszatérés az appba: az app a csak nála levő véletlen verifierrel egyszer felhasználható módon váltja be a jóváhagyást. Nincs custom-scheme deeplink vagy böngészős cookie-kiolvasás.
5. Az Android Keystore AES-GCM titkosítása védi a natív 90 napos eszközkulcsot. A szerver csak SHA256-hashét tárolja. Ennek birtokában az app szervertől kap saját Auth.js titkosított JWT-munkamenet-cookie-t, `Secure; HttpOnly; SameSite=Lax`, legfeljebb 12 órára. Nem tárol Google-jelszót/access/refresh tokent. A WebView-ban nincs Google-OAuth-folyamat.
6. Engedélyezett értesítések esetén Firebase-token létrehozása és **hitelesített**, telefonhoz kötött regisztráció. Tokenfrissítés WorkManagerrel hálózati kapcsolatnál újrapróbálva; következő appindításkor is szinkronizál.

A hozzáférés 90 nap után újrapárosítást igényel; nincs örök credential. Szerveroldali visszavonás a meglévő WebView-sessiont is tiltja a következő privát oldal/API/Server Action kérésnél. Az app menü „Telefon leválasztása” ezt távolról is végrehajtja, majd törli a helyi credential/cookie/cache-t. Offline leválasztást nem hazudik sikeresnek. A weboldal normál kijelentkezése nem vonja vissza a külön 90 napos telefonhozzáférést; ehhez a telefon leválasztását vagy `/mobile` visszavonását használd.

Az admin eszközkezelés a **Konfig / Eszközök / push** részre költözött (`/config#mobile`); a régi `/mobile` cím oda irányít. A böngészős push feliratkozása a saját Értesítési központban található, Android reader nem kap admin eszközlistát. Az APK, telefonpárosítás és natív eszköz-API változatlan.

## OpenCode (1.0.3)

VersionCode **4**, ugyanazzal a release aláírókulccsal. A dashboard **OpenCode** menüpontja kizárólag a tulajdonosnak látható. A teljes webfelület `https://opencode.nas.wydrian.hu` alatt, a dashboardba beágyazva használható; a WebView csak ezt az egy pontos HTTPS hostot engedi hozzá a meglévő hosthoz. Nincs új natív jogosultság vagy JS/native bridge, harmadik fél cookie-ja továbbra is tiltott. Az OpenCode-cookie azonos site-hoz tartozik, HttpOnly/Secure és ötperces; a dashboard külön belépési cookie-ja nem kerül az aldomainre. OpenCode alatt a lehúzásos frissítés tiltott a beágyazott chat/terminál zavartalan görgetéséhez, a menübeli Frissítés használható.

Az új APK-t a meglévő appra telepítsd, **eltávolítás és újrapárosítás nélkül**. Részletek: [opencode.md](opencode.md). Fizikai telefonos WebView/próbafuttatás külön ellenőrizendő.

## Lehúzással frissítés (1.0.2)

Kiadás: versionCode 3, APK `.runtime/artifacts/Wydrian-NAS-1.0.2.apk`, 3 305 339 bájt, SHA256 `8fbce9bcd3bedcd3fe219cbb64a6e90d17bda0285e340230a21ec0f9ee94a859`. 7 Android-unit teszt és release build/aláírás-ellenőrzés sikeres, lint 0 hiba / 13 figyelmeztetés. Az eredeti aláíró tanúsítvány változatlan; az ellenőrzött APK és a védett letöltés legacy aliasa azonos. Telepítés a meglévő appra, eltávolítás nélkül.

Az aktuális weboldal tetején lefelé húzva teljes WebView-újratöltés indul, sötét felületű, menta színű natív állapotjelzővel (`SwipeRefreshLayout` 1.2.0). A lap közepén a gesztus továbbra is görgetés: a callback a WebView `canScrollVertically(-1)` és `scrollY` állapotát vizsgálja. Belépés/párosítás közben, rejtett WebView-nál, nem belső URL-en és folyamatban lévő betöltésnél nem engedélyezett. A jelenlegi oldal megmarad (`reload`, nem főoldali navigáció), a sütik, pairing és push-beállítások nem változnak. Mentetlen űrlapok tartalma újratöltéskor elveszhet.

Főkeret-betöltés végén vagy hálózati/TLS/HTTP hiba esetén leáll a jelző, a TLS-hibák továbbra sem kerülnek megkerülésre. 30 másodperces UI-timeout megakadályozza a beragadt jelzőt, de nem állítja le a WebView hálózati kérését. Activity-megszűnéskor a callback törlődik. A menübeli Frissítés változatlanul elérhető. A `RefreshPolicyTest` a felső/lapközépi, rejtett/foglalt és hibás/külső URL állapotokat vizsgálja; a valódi érintési gesztus telefonon ellenőrizendő, emulátoros/fizikai telefonos próba nem történt.

## Push működése

### Szerveroldali webshoplista — 1.1.4 / versionCode 11

Az egyszeri 1.1.4 appfrissítés után egy későbbi webshophoz elegendő a web/worker forrásregiszterének bővítése; nincs boltonkénti APK-fordítás. Az app a fix `https://nas.wydrian.hu/api/mobile/shops` HTTPS-címet kéri le a meglévő eszköz-bearerrel. A szerver csak aktív, nem lejárt/nem visszavont és továbbra is jogosult telefonhoz ad listát; böngészős cookie nem helyettesíti a bearert. A lista kizárólag az ellenőrzött forráskód-regiszterből ered, soha nem szerkeszthető adatbázis-URL-ből vagy pushból.

Legfeljebb 32 KiB, version 1, 100 shop, shoponként négy pontos domain; nincs wildcard, IP-cím, séma/port/path a domainmezőben. TLS- és redirect-szabályok változatlanok. A nyilvános domainlista privát, backupból kizárt app-cache-ben legfeljebb 24 óráig érvényes; a friss, valid lista az elsődleges, és a kivett boltot sem engedi. Hibás válasz nem írja felül az utolsó valid listát. Lejárt/hiányzó lista esetén csak a korábbi 14 beépített shop szűk offline bootstrapje használható; új/igazolatlan domain nem.

Új shop értesítése csak szintaktikailag biztonságos jelölt URL-t visz a saját Activity-be: **ez még nem engedély**. Látható Activity-ből, szükség esetén háttérszálon frissített lista alapján ellenőrzött shop-ID + pontos HTTPS-host + credential nélküli + 443/default port URL nyílhat. A push nem bővítheti a listát. Offline vagy elutasított új domainnél marad a belső `/pokemon#shop-…` panel. A hálózati lekérés nem az értesítési service-ből indít böngészőt. A session-restoration/token-szinkron szintén frissíti a listát; leválasztás/401 törli a cache-t.

A korábbi appok továbbra is használhatók, új boltnál a belső panel a fallback. **1.1.4 / 11** telepítendő a meglévő appra az eredeti aláírással, eltávolítás/újrapárosítás nélkül. Nincs új jogosultság, JS-bridge vagy FCM-payload-változtatás. A 26/35 API-s Robolectric tesztek új shopot, pontos hostokat, támadó URL-t, hibás/lejárt cache-t és egyszeri értesítésfogyasztást is vizsgálnak; nem helyettesítik a valódi telefonos megnyitást.

### Készletértesítés megnyitása — 1.1.3 / versionCode 10

A készletpushra koppintás közvetlenül a saját `MainActivity`-t indítja, változtathatatlan `PendingIntent`-tel. A látható app az `onResume` után (már nyitott appnál az `onNewIntent` kezelésében) nyitja a webshophoz ellenőrzött HTTPS-terméklinket egy valódi HTTPS-böngészőben. Nem használ böngésző-indító `ACTION_MAIN` selectort, amely elveszítheti az URL-t vagy nem talál megfelelő Activity-t. Alapértelmezett böngésző hiányában a telepített böngészők közül választ; megszűnt/tiltott handler után másik böngészővel próbálkozik. Webshop-app deeplink-kezelőjét nem választja. Ha nincs használható böngésző, magyar visszajelzést ad, a validált `/pokemon#shop-…` készletoldal pedig az appban marad elérhető; nincs néma eltűnés.

A termék URL-jét az értesítés készítésekor és az exportált Activity-be érkezéskor is a webshop-host allowlist ellenőrzi. HTTP, idegen host, credential, nem standard port és `intent:` nem megengedett. Egy értesítés csak egyszer nyit külső oldalt, visszatérés/újra-létrehozás nem ismétli meg. Az eseményazonosító az intent azonosító URI-jában is szerepel: két azonos Java hashű esemény nem írhatja felül egymás célját. Feladat-, release- és tesztpush továbbra is belső dashboard-útvonalon nyílik. Nincs új rendszerjogosultság, JS-bridge, FCM-payload vagy szerver/worker-változás; a párosítás és tokenek megmaradnak.

A javítás az **1.1.3 / 10 APK telepítésével** jut el a telefonra, a korábbi app eltávolítása nélkül, az eredeti aláírással. A régi APK által már létrehozott értesítések korábbi indítási útvonalat tartalmazhatnak; az újonnan érkező készletpush a megfelelő próba. A Robolectric-tesztek API 26 és 35 alatt az Activity-intentet, az URL átadását, egyszeri indítást, böngészőhiányt/váltást és támadó bemeneteket vizsgálják. A valódi értesítési sávból indítást és a telefon böngészőjét külön készülékes teszt igazolja; emulátoros/telefonos próbát ezek a unit tesztek nem helyettesítenek.

- Kizárólag push értesítés: a meglévő Windows Pokémon-worker küldi FCM HTTP v1 API-val. Az e-mail/SMTP küldés eltávolítva.
- Csak aktív felhasználóhoz kapcsolódott, nem visszavont, nem lejárt és pushra feliratkozott Android-eszközök és böngészők. Legfeljebb 10 aktív Android-eszköz és 10 böngésző-feliratkozás fiókonként.
- Webshoponként **saját fiókra** érvényes be/ki értesítési kapcsoló. Admin saját új/visszakészletezés/előrendelés választásai csak saját pushára hatnak; reader opt-in mellett minden eseménytípust kap. Nincs e-mail kapcsoló. A saját kapcsoló nem módosítja más fiók beállítását.
- Új elérhető termék/előrendelés és visszakészletezés eseménye tranzakcióban kerül eszközönként deduplikált outboxba; csendes baseline és történelmi események nem kerülnek kiküldésre. A push saját 1 órás termék/eszköz ismétléskorlátot alkalmaz.
- Beérkezéskor natív értesítés, lezárt képernyőn private visibility; készletpush koppintásakor a webshophoz validált HTTPS-terméklink a böngészőben, belső tartalékként `/pokemon` vagy validált webshop-horgony. Soha nem nyit szerverről kapott tetszőleges URL/intentet. Esemény-ID szerinti helyi deduplikáció.
- Várakozó outbox és Firebase TTL legfeljebb 15 perc. Régi értesítést nem küldünk egy hosszú üzemszünet után.
- „FCM elfogadta” nem bizonyítja a telefonra kézbesítést. Engedély hiánya, internet/Play-szolgáltatás hiánya, gyártói akkumulátorkorlátozás és **Android force-stop** akadályozhatja a fogadást; force-stop után újra meg kell nyitni az appot. Normál bezárt háttérappnál működhet a push, nem garantált azonnali kézbesítés.
- Biztos beküldés előtti hitelesítési hiba/HTTP 401, 429 vagy 503 legfeljebb 5 kísérlet, minimum 1 perc és Retry-After betartásával. Bizonytalan hálózati beküldés/megszakadt sending lease → `uncertain`, nincs automatikus újraküldés. `UNREGISTERED` csak az érintett tokent tiltja, egy közben frissített tokent nem. Saját értesítési beállítás mentése csak a saját eszközök adott shophoz tartozó várakozó pushait törli; a már küldés alatt levőt nem.
- Menüből „Teszt push”, eszközönként legfeljebb 5 percenként. A valódi telefonos beérkezést külön ellenőrizni kell.

## Biztonság

WebView csak a pontos HTTPS `nas.wydrian.hu` és (1.0.3-tól) `opencode.nas.wydrian.hu` originre navigál; webshoplinkek a külső böngészőben nyílnak. Nincs JS/native bridge, file/content access, mixed content, harmadik fél cookie, cleartext HTTP, felülbírált TLS-hiba, release WebView-debug vagy eszközbackup. Native API HTTPS, fix origin/útvonal, átirányítás nélkül, korlátozott válaszmérettel. A pairing JSON API a szükséges nyilvános kivétel; nem ad dashboard-hozzáférést Google-jóváhagyás + verifier nélkül. Eszköz API csak bearer credentialt fogad, nem böngészős cookie-t.

Firebase `android/app/google-services.json` klienskonfiguráció, **nem** szolgáltatásfiók-kulcs; helyi és gitignore-olt. A szerver szolgáltatásfiók JSON-ja `.runtime/secrets/firebase-service-account.json`, tulajdonos/System/Admin full, LocalService csak olvasás. A privát kulcs **soha nem kerül az APK-ba**. FCM OAuth endpoint és projekt fix, nem a JSON/page tartalma vezérli. Ne tedd a szerver credentialt az `android/` mappába.

## Fordítás és üzemeltetés

A felhasználó elfogadta az Android SDK licencet. `scripts/Prepare-Android.ps1`: projekt-lokális JDK 17, Android SDK 35/build-tools 35, Gradle 8.11.1 a `.runtime/android-tools/` mappában; SHA256/SHA1 hash ellenőrzött kiadási ZIP-ek, nincs rendszerszintű telepítés/PATH-módosítás.

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Build-Android.ps1`

Java unit tesztek, lintRelease, assembleRelease, aláírás-ellenőrzés. A build a Gradle verziószámából képezi a verziózott APK nevét, jelen forrásban `.runtime/artifacts/Wydrian-NAS-1.0.5.apk`. A jelenlegi védett download route régi `Wydrian-NAS-1.0.0.apk` útvonala kompatibilitási alias, amelyet csak sikeres build/teszt/aláírás-ellenőrzés és külön publikálási jóváhagyás után frissítünk az aktuális csomagra. Állandó, privát RSA-aláírókulcs: `.runtime/android-signing/`, csak tulajdonos/System/Admin. **Ezt és a védett password fájlt őrizd meg:** ugyanazzal az aláírással később frissíthető az app, elveszett kulcs esetén újratelepítés/újrapárosítás szükséges. Nincs debug-aláírás release APK-ban.

Az új W + modulok ikon forrásverziója **1.0.5 / versionCode 6**, verziózott kimenet `.runtime/artifacts/Wydrian-NAS-1.0.5.apk`; márka és adaptive/themed ikon: [branding.md](branding.md). A build alapból nem publikál: a legacy APK-alias csak külön jóváhagyott `scripts/Build-Android.ps1 -PublishDownload` futtatáskor frissül. Telefontelepítést ez sem végez.

Szerver env: `POKEMON_FCM_CREDENTIALS=.runtime/secrets/firebase-service-account.json`, `POKEMON_PUSH_ENABLED=true`; csak worker/server olvassa. `scripts/Configure-Mobile.ps1` mentés után csak ezt a két változót módosítja. SMTP-konfiguráció többé nem használt. Dashboard staging build és `scripts/Deploy-Pokemon.ps1` új immutable workert telepít; a mobilmodul is része a release-nek. HTTP/robots shopadapterek és ütemezés változatlanok.

Tesztek: `tests/mobile.test.ts` (párosítás, verifier, replay, lejárat, allowlist, visszavonás, JWT, tokenfrissítés, baseline, preference, outbox, uncertain/expiry), `tests/mobile-fcm.test.ts` (HTTP v1/credential/TTL/Retry-After), `android/app/src/test/.../UrlPolicyTest.java`. Szerveroldali OAuth-hitelesítés sikeres; a teljes telefonos párosítás és FCM kézbesítés csak a telepített appal igazolható.

## Élesítés és ellenőrzés — 2026-10-01

109/109 szerveroldali teszt, TypeScript és Next.js production build sikeres. Android release: 3/3 unit teszt, lint 0 hiba (12 ismert figyelmeztetés: szándékos szinkron preferenciamentés/JS, magyar szövegek, SDK-verziójelzés), assembleRelease és APK-aláírás-ellenőrzés sikeres. Firebase BOM 34.19.0; WorkManager 2.10.1 a meglévő SDK 35/AGP 8.9.2 buildhez rögzítve. Java/SDK/Gradle a projekt saját mappájában maradt.

Végleges APK: `.runtime/artifacts/Wydrian-NAS-1.0.0.apk`, 3 285 272 bájt, SHA256 `9c6e2bc0b4eb8dd855cf36039305cba287503510282f106ad9e421790ec37280`. Aláíró tanúsítvány SHA256 `5c2549108b02650086a314a4ccf0f708a1c52287ba5d3d5d854c9afdc3a04c20`. A ZIP-bejegyzések és kibontott tartalom vizsgálata nem talált szolgáltatásfiók-, privátkulcs-, keystore- vagy env-anyagot.

Az első UAC-kérést a felhasználó megszakította; **nem ismételtük automatikusan**. Külön engedély után az új telepítés kilépési kódja 0. Dashboard és worker új verziója aktív; mindhárom Windows-szolgáltatás Running/Automatic, worker LocalService. SQLite-mentések és a korábbi `.next-backup-20261001-231945` build megtartva, IIS változatlan.

21:21 UTC éles ellenőrzés: a 12 shop összes beállítása és baseline-ja megmaradt, mind `ok`, worker heartbeat aktív. SMTP nincs konfigurálva, minden e-mail kikapcsolva, Firebase push konfigurálva és OAuth-hitelesítés igazolt. Nulla párosított telefon és nulla push-feladat: történelmi készleteseményeket nem küldtünk ki. Helyi és nyilvános HTTPS ellenőrzés: `/mobile` és `/pokemon` belépés nélkül 307, `/mobile/download` és `/api/pokemon` 401, hamis bearerrel az eszköz API 401. Nyilvános párosítás indítható, de jóváhagyás nélkül beváltása csak 202 pending, nincs session-cookie. A jóváhagyási oldal normál 200 választ ad. Diagnosztika: `.runtime/research/mobile-deployed.json`.

Letöltés: https://nas.wydrian.hu/mobile (Google-belépés után „Android APK letöltése”), közvetlen védett fájl: https://nas.wydrian.hu/mobile/download. Az autentikált APK-letöltés, a telefonos képernyők/böngészős Google-visszatérés és a valódi FCM-fogadás még a felhasználó készülékén ellenőrzendő; nincs emulátoros vagy fizikai Android-próba. Első használat: telepítés → értesítési engedély → böngészős párosítás egyező kóddal → vissza az appba → menü „Teszt push”.

### 1.0.1 sötét natív fejléc és push-only frissítés

A felhasználó kérésére natív sötét fejléc, popup és rendszer-sávok: a webes `#0c1017/#131923/#242c39/#ecf0f7/#8a95a9/#a8efc9` paletta, mintás „w.” márkajel és 48 dp érintési célú menüikon. Sötét launch/WebView háttér és belépőfelület a fehér villanás ellen; Android 8 támogatás megtartva, API-specifikus theme-elemek külön erőforrásban. Belépés, tokenregisztráció és push-logika változatlan. VersionCode 2, ugyanaz az aláírás: meglévő appra telepítendő, **ne távolítsd el** a korábbi appot, így a párosítás megmarad.

APK `.runtime/artifacts/Wydrian-NAS-1.0.1.apk`, 3 288 368 bájt, SHA256 `fe8fabe5e95357877e02714a1f2743dd2b9c0f7a87006ac18530ddae29abffad`. 3 Android-teszt és lint/aláírás ellenőrzés sikeres, lint 0 hiba. Fizikai telefonos megjelenítési próba nem történt.

Az e-mail külön felhasználói kérésre teljesen kikerült az aktív rendszerből: SMTP-sender/modul és nodemailer függőség eltávolítva, nincs levélsorba állítás, tesztlevél-akció, e-mail kapcsoló vagy előzmény-panel. Az eredeti teszteket valódi push outbox, név, jogosultság, shop-scoped törlés és ismétléskorlát vizsgálatára állítottuk át. 110 szerveroldali teszt, típusellenőrzés, production build és UAC-jóváhagyott telepítés sikeres (exit 0).

Egyszeri `retire-email-v1` migráció kikapcsolja az email-flageket, és törlés nélkül `cancelled` állapotba helyezi a queued/retry leveleket; sent/uncertain/sending történelmi sorok megmaradnak, új levél nem jön létre. A régi adatbázisoszlopok és API kompatibilitási mezők megmaradnak (`smtpConfigured=false`, `mail=[]`). Minden baseline/shopbeállítás és az **1 létező telefonpárosítás/Firebase-token** ellenőrizve megmaradt, a push konfiguráció és worker aktív. Mindhárom szolgáltatás Running, a privát útvonalak védelme helyben/HTTPS-en változatlan. Egy Krodom Cards scan `The operation was aborted` hibával megszakadt; a korábbi 71 termék megmaradt, a normál backoffot nem írtuk felül, a következő ütemezett scan automatikus. Diagnosztika: `.runtime/research/push-only-deployed.json`.
