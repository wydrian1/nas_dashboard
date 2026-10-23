# Utazás

- Az admin oldalsáv **Utazás** pontja (`/travel`) privát HTML-útitervet jelenít meg. Más szerepkörök nem kapnak hozzáférést; az API is adminhitelesítést kér.
- A dokumentum a szerver `data/travel/itinerary.html` fájlja, nem forráskód. Nem kerül GitHubra, `public/` alá vagy a kiadási csomagba. A meglévő `data/` mentés/jogosultság- és kizárási szabályok érvényesek rá.
- Import az aktív projekt könyvtárából: `node --experimental-strip-types scripts/Import-Travel-Itinerary.mjs "<HTML-fájl>"`. Legfeljebb 2 MiB, meglévő fájlt nem ír felül, az eredetit nem módosítja; a másolat hashét ellenőrzi. Nem indít újra szolgáltatást és nem telepít kiadást.
- Az eredeti HTML/CSS elkülönített iframe-ben marad. CSP és sandbox tiltja a scripteket (az inline eseménykezelőket is), formokat, API-kéréseket és a same-origin jogosultságot. A külső HTTPS-képek és új lapon nyíló hivatkozások használhatók; referrer nem távozik. Képek elérhetősége külső szolgáltatótól függ.
- Az útiterv és az API-válasz nem gyorsítótárazható; keresőindexelés tiltott. A route-specifikus CSP/X-Frame-Options kivétel csak az útitervre vonatkozik, a NAS többi oldala nem ágyazható be.
- A menü a webes felületen és az azt megjelenítő NAS Android-appban azonos; natív APK-módosítás nem szükséges.
