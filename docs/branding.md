# Wydrian dashboard ikon

A tulajdonos által jóváhagyott kombináció: négy egyforma, 30×30-as lekerekített mint csempe. Bal felül a kiválasztott **negatív W** pontosan megtartva; jobb felül két listavonal, bal alul három grafikonoszlop, jobb alul két státuszpont/vonal. Paletta: háttér és kivágások `#0c1017`, csempék `#a8efc9`.

- Webes forrás: `public/brand-w-modules.svg`, 128×128-as vektoros koordinátarendszer. A bejelentkezés, az oldalsáv és a favicon ezt használja. Új fájlnév a korábbi böngészőcache elkerülésére; `public/brand.svg` megmarad a régi kliensekhez és rollback buildhez. Nincs külső képbetöltés vagy feliratba sütött márkanév.
- Android: `ic_nas_foreground.xml` ugyanazokat a görbéket használja, csempénként külön összetett pathban, hosszú vektor-path nélkül. Az `evenOdd` kitöltés a W-t és a modulokat valódi átlátszó kivágásként tartja meg, ezért a notification/themed fehér maszkban sem lesznek tömör négyzetek. A launcher háttér/előtérréteg külön adaptive icon (API 26+). Egységes 0,93-as natív skálázás tartja a teljes jelet a középső 66dp-s biztonságos körön belül.
- Natív fejléc: `ic_nas` kép, nem a régi `w.` szöveg. A pairing, jogosultságok, push-fogadás és hálózati védelem változatlan.
- Android-verzió **1.0.5 / versionCode 6**, ugyanazzal a meglévő release aláírókulccsal. Meglévő appra telepítendő, eltávolítás/újrapárosítás nélkül; telepítés külön tulajdonosi művelet.
- A geometria web/Android/monochrome egyezését a `tests/brand.test.ts` ellenőrzi. Módosításkor minden példány együtt frissítendő.

`scripts/Build-Android.ps1` alapból csak az ellenőrzött verziózott APK-t készíti el; **nem** cseréli az éles védett letöltés legacy aliasát. A `-PublishDownload` kapcsoló csak külön engedélyezett APK-publikáláskor használható. Nem telepít telefont és nem indít újra szolgáltatást.
