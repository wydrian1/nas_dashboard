# Böngészős push feliratkozás

Az adminok és Pokémon-olvasók a `/notifications` oldalon (adminnak `/config#notifications`) iratkozhatnak fel. A webes FCM-azonosító ugyanabba a szerveroldali, személyhez kötött eszköz- és outbox-rendszerbe kerül, mint az Android-token: a webshop-, quiet-hours- és figyelőlista-szabályok azonosak, a fiók letiltása és adminisztrátori visszavonás a böngészőpushra is érvényes. Az `info-reader` szerepkör nem kap push hozzáférést. A böngészőengedélyt a felhasználó adja meg; a weboldal csak gombnyomáskor kér engedélyt.

## Firebase egyszeri webes beállítás

1. A meglévő `nas-wydrian-hu` Firebase-projektben regisztrálj **Web appot**. Az Android `google-services.json` nem helyettesíti a web app `appId` értékét.
2. A Firebase Console Cloud Messaging részében generálj Web Push tanúsítvány-kulcspárt. A **nyilvános VAPID-kulcs** a web buildhez kell; a privát kulcsot ne használd és ne másold a repóba.
3. A projekt védett `.env.local` fájljába vedd fel a web app konfigurációt:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase web app apiKey>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nas-wydrian-hu
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<Firebase sender ID>
NEXT_PUBLIC_FIREBASE_APP_ID=<Firebase web app appId>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<Firebase Cloud Messaging public VAPID key>
# Opcionális web app mezők:
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<Firebase web app authDomain>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<Firebase web app storageBucket>
```

Ezek a Firebase web app **nyilvános klienskonfigurációi**; nem szolgáltatásfiók-hitelesítők. A `POKEMON_FCM_CREDENTIALS` továbbra is kizárólag a meglévő szerver/worker-oldali, titkos FCM-szolgáltatásfiók-fájlra mutat. A szerver env és nyilvános webkonfiguráció együttesen szükséges a feliratkozás gomb aktiválásához. A `NEXT_PUBLIC_*` értékek buildkor kerülnek a klienscsomagba, ezért módosításuk után új web build/élesítés szükséges.

A `public/firebase-messaging-sw.js` saját, helyben szolgáltatott service worker; nem tölt be távoli JavaScriptet. Az FCM adatüzenetből helyi böngészőértesítést jelenít meg, kattintáskor pedig csak az aktuális dashboard-originre navigál. A HTTPS origin kötelező. A felhasználó bármikor kikapcsolhatja a feliratkozást a dashboardon vagy visszavonhatja az értesítési engedélyt a böngésző beállításaiban. A szerver csak a token hash-ének helyett a küldéshez szükséges Firebase-token tárolását végzi a már meglévő eszközrekordban; tokent, előfizetési titkot vagy nyers payloadot nem ad vissza az API.

Teszteléshez éles push-t ne küldj automatikusan: valódi FCM kézbesítés csak külön, feliratkozott böngészővel végezhető. Az FCM `sent` státusza a szolgáltató elfogadását jelenti, nem a böngésző megjelenítésének bizonyítékát.
