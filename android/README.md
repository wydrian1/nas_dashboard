# Wydrian NAS

Android 8+ privát WebView-app, FCM push és külső böngészős Google-jóváhagyás.

Ugyanaz az APK használható `admin` és `pokemon-reader` szerepkörrel. A szerver minden oldalon/API-n dinamikusan ellenőrzi a fiók aktuális szerepkörét; reader alapoldala `/pokemon`, csak saját push kapcsolókat lát, eszközlistát nem. Új fiókot az admin a webes Konfig / Felhasználók alatt engedélyezhet. Részletek: `../docs/roles.md`.

1. A Firebase Android-kliens `google-services.json` fájlja: `app/google-services.json` (nem kerül verziókezelésbe).
2. Projekt-lokális Windows buildkörnyezet: `../scripts/Prepare-Android.ps1` (SDK-licenc elfogadása szükséges).
3. Aláírt APK, tesztek és lint: `../scripts/Build-Android.ps1`.
4. Aktuális APK: `../.runtime/artifacts/Wydrian-NAS-1.0.2.apk` (sötét natív fejléc, lehúzással frissítés, versionCode 3).

A meglévő appra telepíthető, ugyanazzal az aláírással; nincs újrapárosítás. A védett webes letöltés régi `Wydrian-NAS-1.0.0.apk` fájlneve kompatibilitási alias: a legutóbbi ellenőrzött csomagot szolgálja ki. Nincs szükség szerverújraindításra egy APK frissítésekor.

Az aktuális weboldal tetején lefelé húzva frissíthető az oldal (natív `SwipeRefreshLayout`, sötét/mintás állapotjelző). Nem vált vissza a főoldalra, és nem töröl sütit vagy párosítást. A lap közepén végzett normál görgetés nem indít frissítést; a belépő/párosító képernyőn és folyamatban lévő betöltéskor le van tiltva. A jelző leáll a betöltés végén, főoldali hálózati/TLS/HTTP hiba esetén, illetve legfeljebb 30 másodperc után. A menübeli Frissítés továbbra is használható.

A szolgáltatásfiók privát JSON-ja **tilos** ebben a mappában vagy APK-ban. Csak a szerver használja.
Az app nem használ Google Sign-In SDK-t; FCM-hez nem kell Android OAuth kliens vagy SHA-1 fingerprint regisztráció. A meglévő dashboard Google-belépése a rendszerböngészőben történik.

Részletes használat, adatbiztonság, párosítás, értesítési korlátok és szerveroldal: `../docs/android-app.md`.
