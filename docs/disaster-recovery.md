# Teljes szervervesztés utáni helyreállítás

Ez a csomag az eredeti szerver/projekt nélkül is visszafejti és ellenőrzi a Wydrian NAS titkosított mentését. Nincs npm-függősége, nem Windows-fiókhoz kötött. **Node.js 24 és tar szükséges**; Windows 11 / friss Windows 10 alatt a tar része a rendszernek. A csomag nem tartalmaz visszafejtőkulcsot vagy más titkot.

## Amit még a katasztrófa előtt külön meg kell őrizni

1. **recovery-key.json**: jelenlegi helye `D:\!nas\.runtime\backup-secrets\recovery-key.json`. Mentsd független USB-re vagy jelszókezelőbe. Ne küldd el chatben, ne tárold nyilvánosan, ne tedd titkosítatlanul a Drive-mentések mellé. Kulcs nélkül a mentés végleg olvashatatlan.
2. **backup-recovery-kit.zip**: jelenlegi helye `D:\!nas\.runtime\backup-secrets\backup-recovery-kit.zip`. Mentsd független helyre is. Nem titkos; benne a `restore.mjs`, `backup.mjs`, útmutató és SHA-256 ellenőrzőlista. Ezt nem kell az eredeti projektből újra előállítani.
3. Google-fiók hozzáférése, **másik eszközön is működő 2FA/passkey vagy helyreállítási kódok**. A mentések a saját Drive **Wydrian-NAS-Backup** mappájában vannak. Saját OAuth-kliens/token nem kell a kézi Drive-letöltéshez.

Legalább egy offline kulcspéldány legyen fizikailag is távol a szervertől.

## 1. Archívum és eszközök beszerzése új gépen

- Jelentkezz be a Google Drive-ba és töltsd le a legutóbbi használható `.nasbackup` archívumot. Több mentés közül választhatsz a 30 napos megőrzésen belül. Ez a mentéskori állapotot tartalmazza, nem a szervervesztés pillanatáig tartó összes változást.
- Telepíts hivatalos **Node.js 24 LTS**-t: https://nodejs.org/en/download . Ellenőrzés: `node --version`, `tar --version`.
- Bontsd ki a külön megőrzött `backup-recovery-kit.zip`-et, és másold át a kulcsot biztonságos helyre. Az archívum ne legyen kicsomagolva vagy átnevezve `.zip`-re: titkosított bináris fájl.

## 2. Visszafejtés és ellenőrzés új, nem létező célmappába

PowerShell, a kibontott helyreállító csomag könyvtárában:

```powershell
node .\restore.mjs --archive "C:\Recovery\letoltott.nasbackup" --key "E:\offline-kulcs\recovery-key.json" --destination "D:\!nas"
```

A célmappa **nem létezhet**. A visszaállító meglévő adatot nem ír felül, nem indít szolgáltatást és nem küld push értesítést. A célmappa Windows alatt csak az aktuális felhasználónak, SYSTEM-nek és rendszergazdáknak ad hozzáférést. A kulcs hordozható, nem függ a régi Windows-felhasználótól.

AES-256-GCM hitelességellenőrzés, biztonságos archívumútvonal- és fájltípus-ellenőrzés, az összes manifestfájl SHA-256 ellenőrzése, majd SQLite integrity check fut. Siker esetén `sqliteIntegrityVerified: true`, `productionUntouched: true` és ellenőrzött fájldarabszám jelenik meg. Hibánál ne indítsd el a részlegesen kibontott projektet; másik **új** célmappával próbálj egy korábbi archívumot. A rövid életű plaintext munkakönyvtár ugyanebben a védett célmappában van.

## 3. Az alkalmazás újratelepítése

A visszaállított mappában megvan a forrás, a konzisztens SQLite (pénzügyi előzmények, LEGO, notes/todos, felhasználók/szerepkörök, telefonpárosítások, Pokémon-előzmények és beállítások), `.env.local`, Firebase-kulcsok, TLS-tár, Android signing és kiadott APK. Függőségek/build cache, Node/Caddy/Android SDK, Windows-feladatregisztráció nem része a mentésnek; ezek újratelepítendők.

- Lehetőleg ugyanoda (`D:\!nas`) állítsd vissza; eltérő útvonalnál állítsd át az `.env.local` abszolút útvonalait és az üzemeltetési konfigurációkat. Ellenőrizd külön a Firebase credential útvonalat. A `.env.local` tartalmát ne publikáld.
- Node 24 legyen a folyamat PATH-jában. A projektgyökérből: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
- A szolgáltatástelepítő a projekt `.runtime/node-v24*-win-x64/node.exe` példányát várja; töltsd le a hivatalos Windows x64 Node 24 zipet a nodejs.org-ról, és bontsd a `.runtime` alá ebben az elnevezésben. A Caddy hivatalos Windows x64 binárisa kerüljön a `.runtime/caddy/caddy.exe` helyre.
- Rendszergazdai PowerShellben, **friss gépen**, szabad 3000/443 port mellett: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\Install-Services.ps1`. Ez csak WydrianDashboard és WydrianHttps szolgáltatásokat hoz létre. A régi rendszerben ezek LocalSystem alatt működtek; telepítés után ellenőrizd a tényleges szolgáltatásidentitást, ne csak az XML-t. Az eredeti működéshez szükség esetén `sc.exe config WydrianDashboard obj= LocalSystem` és `sc.exe config WydrianHttps obj= LocalSystem`, majd újraindítás. Más alkalmazások szolgáltatásait ne módosítsd.
- A worker indulásakor már képes valós pushokat küldeni. Próba-helyreállításhoz előbb kapcsold ki a push/worker futását; végleges új szerveren a `scripts\Install-Pokemon-Worker.ps1` telepíti a LocalService workert a helyreállított beállításokkal. Egyszerre csak egy aktív szerver figyeljen/küldjön pushokat.
- Ellenőrizd az ACL-t a `data`, Firebase és Android signing titokfájlokon. A LocalService worker csak a szükséges projektadatokat olvashassa; a mentéskulcshoz és mentéskönyvtárhoz ne kapjon jogot.
- DNS és router TCP 443 porttovábbítás az új gépre mutasson; 3000-et ne nyisd meg kívülre. Ha marad a `nas.wydrian.hu` cím, a Google dashboard callbackje és a telefonok szervercíme változatlan lehet. Lejárt TLS-t a Caddy megújítja, ha a DNS/443 jó. Az APK újratelepítése önmagában nem szükséges; a kulcsok/titkok visszaállításával a meglévő párosítások várhatóan használhatók, de valódi telefonon ellenőrizni kell.
- Újra állítsd be a napi mentést a `docs/backups.md` alapján: védett mappák, rclone, külön Desktop OAuth JSON letöltése a meglévő mentési Google-projektből, Google-jóváhagyás, Windows napi feladat és valódi feltöltés/visszaállítási teszt. Az új mentéskulcsot is mentsd offline; a régi kulcsot tartsd meg a régi archívumokhoz.

## Korlátok

**Ez az alkalmazás mentése, nem teljes lemezkép.** Nem állítja vissza a Windowst, RAID-konfigurációt, Plex/Jellyfin/qBittorrent adatbázisát vagy médiatárát, más szerveralkalmazásokat, illetve router/DNS/Google/Firebase-fiókokat. A visszaállításhoz új működő gép és hálózati beállítások kellenek. Napi mentéssel legfeljebb nagyjából egy napnyi alkalmazásadat veszhet el sikeres napi futások esetén; sikertelen mentések vagy hosszabb kiesés ezt növelhetik.
