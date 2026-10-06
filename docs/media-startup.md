# Plex és Jellyfin indítása Windows-bejelentkezés előtt

Az indítást az eredeti Windows-felhasználóhoz kötött `WydrianMediaStartup` feladat végzi: gépindítás + 60 másodperc, Password batch bejelentkezés, Limited jogosultság. Nem SYSTEM, nem automatikus Windows-belépés, és nem médiaszerver-újratelepítés. A meglévő Plex frissítőszolgáltatás nem maga a Plex Media Server; a felhasználói Run/tray bejegyzések csak Windows-bejelentkezéskor indulnak.

## Előkészítés és helyi telepítés

- A forrás a külön feladatágon szerkeszthető, a futó dashboard/Caddy forrásának lecserélése nélkül. Az operatív cél kizárólag `D:\!nas`; nem a régi rollback másolat.
- `scripts/Prepare-MediaStartup.ps1 -ExpectedRunnerSha256 <scripts/Start-MediaServers.ps1 SHA-256> -CheckOnly`: olvasási célú folyamat/profil/listener ellenőrzés, fájl-/feladat-/szolgáltatásmódosítás nélkül. Mindkét eredeti, már működő médiaszerver szükséges a biztonságos profilfelismeréshez.
- Ugyanez `-CheckOnly` nélkül privát, hash-ellenőrzött runner/settings másolatot és jelszó nélküli feladat-XML-t készít a `.runtime/media-autostart/releases` alatt; nem regisztrál/indít feladatot, nem kér jelszót és nem indítja újra az alkalmazásokat. A teljes meglévő médiaszerver-adatbázis mentését nem végzi: nem migrál és nem módosít adatokat.
- A tulajdonos rendszergazdai Windows Feladatütemezőben importálja az XML-t `WydrianMediaStartup` néven. Az eredeti felhasználóval, bejelentkezés nélkül, legmagasabb jogosultság **nélkül**, a jelszó tárolásának tiltása **nélkül**. A tényleges Windows/Microsoft-fiókjelszót kizárólag a helyi Windows-ablakban kell megadni; PIN nem helyettesíti. A hitelesítést csak a Windows tárolja, nem az XML, a projekt vagy az agent.
- A feladatot először a még működő médiaszervereken kell próbafuttatni: mindkettőre sikeres „alreadyRunning” eredmény és 0 feladateredmény szükséges, változatlan PID-ekkel. Ez nem valódi hidegindítási teszt. Újraindítást külön tulajdonosi engedély nélkül nem végezhetünk.

## Adatmegőrzés és ellenőrzések

A Plex a meglévő eredeti HKCU/profil adatokat és a már meglévő könyvtáradatbázist használja. Egyéni `LocalAppDataPath` vagy indítási argumentum külön felülvizsgálatot igényel; az eszköz nem talál ki másik profilt. Ellenőrzése: eredeti folyamatútvonal/tulajdonosi SID, 32400 listener és a meglévő claimed szerver azonosítója a loopback `/identity` válaszából. Plex token nem kerül a feladatba vagy naplóba.

A Jellyfin a már futó szerver pontos `--datadir` argumentumát tartja meg. Meglévő `config/system.xml`, `config/network.xml` és `data/jellyfin.db` szükséges; a HTTPS/HTTP listener a meglévő hálózati konfigurációból származik. Ellenőrzése: pontos eredeti executable/SID, `--datadir` és a szerverhez tartozó listener. Ez **nem hitelesített API/lejátszási ellenőrzés**; a helyi HTTPS-cert ellenőrzését nem kapcsoljuk ki és nem cseréljük le a tanúsítványt.

Ha a szerver már egészségesen fut, a runner nem indít semmit. Élő, de nem megfelelő/hibás folyamat, más tulajdonos, más adatkönyvtár, több példány, foglalt port vagy hiányzó adatbázis esetén az adott alkalmazás hibára zár; nem állítja le és nem próbálja helyettesíteni. Mindkét célt külön próbálja, egyik hibája nem akadályozza a másik ellenőrzését. Nincs automatikus médiatár-felépítés, adatbázis-/konfiguráció-/tűzfal-/felhasználóváltoztatás. Az alkalmazások normál, azonos útvonalon történő frissítését nem blokkolja verzióhoz kötött executable-hash.

A bejelentkezéskori eredeti Run/tray bejegyzéseket az előkészítés nem módosítja. Az első hidegindítás **és az utána történő bejelentkezés** során ellenőrizni kell, hogy nem keletkezik második példány. Ha a tray új szervert próbál indítani, a megfelelő régi login-startup bejegyzést csak célzott tulajdonosi jóváhagyással és visszaállítható mentéssel szabad kikapcsolni. Hálózati/mappelt meghajtók, média-hozzáférés, lejátszás/hardveres transzkódolás és tényleges bejelentkezés nélküli elérhetőség hidegindítás után külön ellenőrzendő; ezeket a meglévő folyamatokon futó indítópróba nem bizonyítja. Adat-/portváltozás vagy Windows-jelszóváltás után a feladat beállításait is felül kell vizsgálni.

A feladatnak nincs időkorlátja, hogy az általa indított hosszú életű médiaszervereket ne állítsa le egy feladat-timeout. Ez indítási feladat, nem folyamatos watchdog. Visszavonás: emelt PowerShellben `Unregister-ScheduledTask -TaskName WydrianMediaStartup -Confirm:$false`; ez nem állítja le a médiaszervereket és nem törli adataikat.
