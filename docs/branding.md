# Wydrian dashboard ikon

A tulajdonos által kiválasztott négycsempés jel: a bal felső lekerekített négyzetből kivágott **W**, függőleges külső szárakkal; a másik három négyzet változatlan. Paletta: háttér `#0c1017`, jel `#a8efc9`.

- Webes forrás: `public/brand.svg`, 128×128-as vektoros koordinátarendszer. A bejelentkezés, az oldalsáv és a favicon ezt használja. Nincs külső képbetöltés vagy feliratba sütött márkanév.
- Android: `ic_nas_foreground.xml` ugyanaz a négy path; a launcher háttér/előtérréteg külön adaptive icon (API 26+), az API 33+ monochrome ugyanazt a jelalakot használja fehérben, háttérkitöltés nélkül. A jel a középső biztonságos tartományban marad, így kör/squircle maszk sem vágja le.
- Natív fejléc: `ic_nas` kép, nem a régi `w.` szöveg. A pairing, jogosultságok, push-fogadás és hálózati védelem változatlan.
- Android-verzió **1.0.4 / versionCode 5**, ugyanazzal a meglévő release aláírókulccsal. Meglévő appra telepítendő, eltávolítás/újrapárosítás nélkül; telepítés külön tulajdonosi művelet.
- A geometria web/Android/monochrome egyezését a `tests/brand.test.ts` ellenőrzi. Módosításkor minden példány együtt frissítendő.

`scripts/Build-Android.ps1` alapból csak az ellenőrzött verziózott APK-t készíti el; **nem** cseréli az éles védett letöltés legacy aliasát. A `-PublishDownload` kapcsoló csak külön engedélyezett APK-publikáláskor használható. Nem telepít telefont és nem indít újra szolgáltatást.
