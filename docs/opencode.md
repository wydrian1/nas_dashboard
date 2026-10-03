# OpenCode a privát dashboardban

- Dashboard: `https://nas.wydrian.hu/opencode`.
- Eredeti OpenCode 2 web UI: `https://opencode.nas.wydrian.hu`, a dashboard oldalába beágyazva.
- Kizárólag az `ALLOWED_EMAIL` tulajdonos és érvényes párosított telefonjai használhatják. Más admin és Pokémon-reader sem fér hozzá.
- Android 1.0.3 engedi a két pontos HTTPS hostot; OpenCode alatt a lehúzásos frissítés tiltott, hogy ne szakítsa meg a chat/terminál görgetését.

## Védelem

A dashboard saját Google/Auth.js cookie-ja host-only marad. A külön aldomain csak egy 5 perces, titkosított, `Secure; HttpOnly; SameSite=Lax` hozzáférési cookie-t kap; annak lejárata nem lehet későbbi a dashboard-munkameneténél. A beágyazó oldal kétpercenként és előtérbe kerüléskor újítja meg. A külön megnyitott fülhöz a dashboard-oldalt is hagyd nyitva.

A cookie-munkamenet szerveroldali, hash alapján tárolt családhoz kötött. Kijelentkezés visszavonja a család korábbi cookie-példányait is. A telefon visszavonását minden kérés ellenőrzi. SSE/WebSocket és hosszú válaszok jogosultságát az átjáró 15 másodpercenként újra ellenőrzi; az eredeti kérés cookie-jának lejártakor megszakítja őket, a kliens újra kapcsolódhat az új cookie-val. Így lejárt jogosultság nem tarthat fenn korlátlan kapcsolatot.

Az átjáró minden UI-, asset-, API-, SSE- és WebSocket-kérést ellenőriz, hibánál zárva marad. Csak saját eredetű írás/WS megengedett. Az OpenCode saját `/auth/*` és `/api/pair` belépése kívülről tiltott. Kliens Authorization/Cookie és forwarded fejlécek nem kerülnek továbbításra; a helyi OpenCode-jelszót csak a szerveroldali proxy használja. OpenCode belépési cookie-t/jelszót nem küld vissza a kliensnek. A felület csak a dashboardba ágyazható.

Ez nem korlátozott chat-szolgáltatás: a tulajdonos a teljes helyi OpenCode-fiókhoz fér hozzá, projektekkel, fájlműveletekkel, terminállal és modell/provider beállításokkal. A szerveren beállított OpenCode-jóváhagyások érvényesek. Más felhasználót ne engedj hozzá.

## Üzembe helyezés

1. DNS: `opencode.nas` CNAME → `nas.wydrian.hu`, **DNS only**, nem Cloudflare-proxy. Csak a meglévő HTTPS 443 továbbítása kell; 3101/49374 nem lehet publikus.
2. Tesztek, typecheck, staging build és Android teszt/lint/aláírt build után aktiváld a dashboard buildet.
3. `.env.local`: `OPENCODE_WEB_ENABLED=true` (titkok és helyi állományok nem kerülnek Gitbe).
4. Emelt PowerShell: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\Install-OpenCode-Gateway.ps1`. Meglévő, ellenőrzött WinSW-t használ; csak új `WydrianOpenCodeGateway` SYSTEM szolgáltatást telepít, loopback `127.0.0.1:3101` hallgatással. Verziózott kódmásolatot készít a `.runtime/opencode-gateway/releases` alatt, így a későbbi forrásszerkesztés nem változtatja meg a futó átjárót. Ez nem OpenCode-szerver és nem futtat modelleket/parancsokat.
5. Ellenőrizd/indítsd újra a `WydrianHttps` Caddy szolgáltatást az új aldomain konfigurációjával. Ellenőrizd a HTTPS-tanúsítványt és anonim/reader/más-admin tiltást, tulajdonosi UI/API-t, streaminget és visszavonást.

Első élesítéshez a 3–5. lépést együtt elvégzi az emelt `scripts/Deploy-OpenCode.ps1`: előbb védett helyre menti a korábbi `.env.local` fájlt, aktiválja a tesztelt staging buildet (adatbázismentéssel), telepíti az új átjárót, és újraindítja a Caddyt. Hibánál visszaállítja az env-et és leállítja az átjárót; meglévő gateway szolgáltatást nem ír felül. Az eredeti OpenCode és a Pokémon-worker nem indul újra.

Az átjáró védett `.runtime/opencode-gateway/settings.json` fájlja az **eredeti Wydrian OpenCode-fiók** `.local/state/opencode/service.json` elérési útját tárolja, nem a jelszót. Minden kérésnél onnan olvassa a friss hitelesítést; a cél kizárólag `http://127.0.0.1:49374`. Nem állítja át, nem indítja újra és nem módosítja az OpenCode-ot vagy a beszélgetéseket. Az eredeti OpenCode-szolgáltatásnak futnia kell; annak desktop/user profil nélküli, újraindítás utáni indulása külön üzemeltetési feladat. Nem helyettesíti a desktop OpenCode telepítését vagy frissítését.

## Visszaállítás és hibaelhárítás

`OPENCODE_WEB_ENABLED=false` és dashboard újraindítás azonnal letiltja az átjárót; legfeljebb 15 másodperc után a nyitott kapcsolatok is lezárulnak. A gateway leállítható az eredeti OpenCode érintése nélkül. `logs/WydrianOpenCodeGateway*` csak indulási/folyamathiba naplókat tartalmaz; nem naplóz cookie-t, jelszót, promptot vagy proxytartalmat.

Az alkalmazásmentés tartalmazza az új forrásokat, a dashboard hozzáférési táblát és a projekt `.runtime` operációs konfigurációját a mentési szabályok szerint. **A felhasználói profilon kívül élő OpenCode adatbázis/beszélgetések, provider belépések és globális OpenCode-konfiguráció mentését ez a fejlesztés nem adja hozzá.** Teljes gépcsere után az eredeti OpenCode-profil külön helyreállítást/újra-belépést igényel, és a gateway állapotfájl-útját ellenőrizni kell.
