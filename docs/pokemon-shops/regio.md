# REGIO JÁTÉK — Pokémon-kártyák

Forrás: `https://www.regiojatek.hu/index.php?action=webstore&pf-filters=(((category%20eq%20%27K%C3%A1rtya%27)))&query=pokemon&ws_action=search`.

Külön 17. forrás, **alapból szüneteltetve**, `INSERT OR IGNORE` regisztrációval. A meglévő boltok, beállítások, párosítások és értesítési szabályok nem változnak. Az élesítés és bekapcsolás külön jóváhagyást igényel.

## Ellenőrzött adatszerződés

- A 2026-10-18-i normál headless Chromium-próba HTTP 200-at kapott. A kereső JavaScriptes Prefixbox-integrációt használ: a normál oldal maga indít egy nyilvános GET `/search/results/` kérést az `api.prefixbox.com` címen. Csak ezt a megfigyelt kérést figyeljük; nincs közvetlen API-hívás vagy alternatív végpont.
- A keresés pontosan `pokemon`, a kategóriaszűrő `(((category eq 'Kártya')))`, az oldal 1, a lapméret 30. A nyilvános integráció-/keresőazonosító nem titok. A user/session UUID-k a friss böngésző saját azonosítói, nem importált profilból származnak.
- A keresési válasz összesítőjének, lekérdezési/szűrési metaadatainak és minden termékének egyeznie kell a teljesen kirajzolt DOM-mal. Elsőre csak nyolc kártya töltődött be; a többit egyenként görgetjük láthatóvá, kattintás nélkül. Hiányzó kártya, placeholder, eltérő darabszám vagy lapozás hiba.
- A megfigyelt 20 találatból 19 Pokémon-termék, egy idegen ajánlott kártyajáték volt. A teljes találatszámot minden kártyával igazoljuk, de a nem Pokémon nevű termékeket kizárjuk. A kereső találatszáma nem azonos a mentett készletes Pokémon-termékek számával.
- Az ID a keresési `identifier`, a vezető nullák megőrzésével; SKU-ként ugyanez szerepel. A terméklink kizárólag `https://www.regiojatek.hu/termek-<ID>-<slug>.html`. A keresési és DOM-adatok, kosárgomb termékszáma és belső termékazonosítója egyezzen.
- Készlethez egyszerre kell `availability='in stock'`, egyetlen aktív „Kosárba” gomb és tényleges CSS-láthatóság. Az `out of stock` és `available for order` + „Részletek” állapot nem készlet. Ismeretlen elérhetőség hiba; áruházi készletből és terméknévből nem következtetünk webes rendelhetőségre vagy előrendelésre.
- Ár csak egyező, egyértelmű egész HUF-értékből; egyébként `null`. Kép csak az ellenőrzött HTTPS `www.regiojatek.hu/data/regio_images/data/regio_images/preview/<ID>_<index>.(webp|jpg|jpeg|png)` útvonalról, query, fragment és hitelesítési adat nélkül.
- Egyelőre csak **1–30 találatos teljes egyoldalas lista** támogatott. Nulla találat, kizárólag idegen ajánlások, több oldal vagy minden kosárgomb rejtettsége nem válhat üres baseline-ná. A teljes pozitív találati listán egyértelműen nem készletes Pokémon-kártyák megengedettek.

## Hálózati és futtatási szabályok

- A tulajdonos kifejezett kérésére **nincs REGIO robots.txt-kérés vagy ellenőrzés**. Más boltok robots-kezelése változatlan.
- Normál headless Chromium, friss nem tartós kontextus; nincs cookie-import, bejelentkezés, UA-átírás, stealth, proxyváltás vagy CAPTCHA-megoldás. Ugyanaz a Playwright/Chromium telepítési előfeltétel, mint az Alzánál. A valódi `LocalService` workerfiókkal, izolált forrásmásolattal és a termelési függőségekkel végzett próba sikeres: **19 termék, 19 kép, 19 ár, 1 oldal**, alapértelmezett böngészőútvonalon, környezeti fájl és DB nélkül. Az ideiglenes tesztfeladat eltávolítva; ez nem éles telepítés vagy baseline.
- Csak a megadott dokumentum, felülvizsgált REGIO statikus erőforrások, a rögzített Prefixbox-integráció, az egyetlen pontos keresés és a szükséges rögzített noUiSlider CDN-fájl engedett. Minden host nyilvános DNS-re rögzített; minden más host, POST, tracking, kosár/belépés, kapcsolódó keresések, websocket és service worker blokkolt. A Chromium sandbox bekapcsolva marad.
- A 403/CAPTCHA `protected`, 429 `rate_limited`, a többi hiányos/sikertelen lekérés hiba; nincs ismétlés vagy API-fallback. A meglévő termékek/baseline megmaradnak, a közös hibavárakozás és `Retry-After` érvényes.
- Az első teljes baseline csendes; a későbbi új/újrakészletezett termékek a meglévő személyes pushszabályokat követik. Az Android dinamikus hostengedélye kizárólag `www.regiojatek.hu`; nincs APK- vagy újrapárosítási változás.

## Ellenőrzés

- `npm test`: szintetikus API + DOM, pontos URL-/szűrési policy, teljesség, ID/kosár/ár/kép, idegen ajánlás kizárása, hibák, csendes baseline, új/restock push és adatmegőrzés.
- `node scripts/Test-Regio-Browser.mjs`: valódi Chromium, kizárólag szintetikus route-ok; lazy betöltés, CSS-láthatóság, 403/429/CAPTCHA, részleges lista és tiltott hálózati írások. A kiadási ellenőrzés része.
- `node scripts/Test-Browser.mjs`: külön REGIO-panel, pontos forráslink és szüneteltetett alapállapot admin/olvasó nézetben, izolált DB-vel.
- `node scripts/Probe-Regio.ts --live`: kizárólag kézzel indítható, időkorlátos, olvasási élő próba; nincs DB-, baseline-, esemény-, kosár- vagy értesítésmódosítás.
