# Korlátozott admin-segéd

## Hatókör és használat

Tulajdonosi oldal: `https://nas.wydrian.hu/config#admin-helper`, weben és az Android-appban. Más admin és Pokémon-reader nem látja és az API-t sem használhatja.

**Kizárólag a négy meglévő, már futó szolgáltatás újraindítása:**

| Azonosító | Windows-szolgáltatás |
| --- | --- |
| `dashboard` | `WydrianDashboard` |
| `https` | `WydrianHttps` |
| `pokemon` | `WydrianPokemon` |
| `opencode-gateway` | `WydrianOpenCodeGateway` |

Nem futtat parancssort, PowerShellt, szkriptet, telepítést, build-élesítést, szolgáltatáskonfigurálást vagy tetszőleges fájlműveletet. Nem indítja újra az eredeti OpenCode-ot, Windowst vagy médiaszolgáltatásokat. Nincs függő szolgáltatásokra kiterjedő leállítás. Leállított szolgáltatás indítása sem engedélyezett.

Az OpenCode normál felhasználóként **csak kérést** küldhet:

```powershell
.runtime\node-v24.21.0-win-x64\node.exe scripts\Request-AdminRestart.mjs pokemon
```

A kérés semmit nem indít újra. A tulajdonos a Konfigban kiválasztja az **Áttekintés** gombot, elolvassa a cél és a megszakadás leírását, majd beírja a pontos szolgáltatásnevet és a **Jóváhagyom az újraindítást** gombra kattint. A teljes kérelem legfeljebb **2 percig** él; az áttekintés nem hosszabbítja meg. A megerősítés az áttekintő titkosított dashboard-munkamenethez kötött, aktuális telefon-/felhasználójogosultság-ellenőrzéssel. Egy kérés csak egyszer indítható, egyszerre egy újraindítás futhat, ugyanarra a célra 3 perces várakozás van. A helyi kérés címkéje nem bizonyítja, hogy valóban OpenCode küldte; mindig ellenőrizd a célt.

Jóváhagyás után a segéd önállóan végzi a műveletet; a dashboard/HTTPS átmeneti kiesése nem állítja meg. A felület csak állapotot kérdez újra, műveletet soha nem ismétel automatikusan. Folyamat-/géphiba után a korábbi queued/running kérés **bizonytalan**, nem fut újra. A Running eredmény a Windows-szolgáltatás állapota, nem teljes alkalmazás-/push-/HTTPS-funkcióteszt.

## Jogosultsági határ

- A segéd **nem SYSTEM és nem admin**: saját `NT SERVICE\WydrianAdminHelper` virtuális Windows-fiók alatt fut, jelszó és admin-csoporttagság nélkül. Induláskor visszautasítja a SYSTEM/admin/más fiókot.
- A négy cél SCM-jogosultsága pontosan `QUERY_STATUS | START | STOP` (`0x34`). Nem kap ChangeConfig, Delete, WRITE_DAC vagy WRITE_OWNER jogot. A többi szolgáltatás jogosultságai változatlanok.
- A segéd service tokenjének required-privileges listája kizárólag `SeChangeNotifyPrivilege` (fájlrendszer-áthaladás); nem kap SeImpersonate, SeDebug, backup/restore vagy token-hozzárendelési privilégiumot. A `sidtype unrestricted` csak a saját service SID hozzáadásának Windows-elnevezése, nem admin-/SYSTEM-jog.
- A bináris és teljes vezérlési credential a **`C:\Program Files\Wydrian NAS Admin Helper`** védett, SYSTEM-tulajdonú könyvtárban van, SYSTEM/Admin full és a segéd saját SID-jének RX jogával. A segéd sem írhatja át a binárisát/configját; kizárólag a `data` alatti saját állapotát/auditját írhatja.
- Ez a tulajdonos által jóváhagyott kivétel a D:-n tartott operációs fájlok szabálya alól. Az aktív NAS-projekt, források, build, adatbázis és szolgáltatások továbbra is `D:\!nas` alatt vannak; a régi C: projekt rollback-only marad.
- Loopback `127.0.0.1:3102`, HTTP.sys prefix kizárólag a segéd SID-jének fenntartva. Nem nyitunk tűzfalat/routerportot, Caddy sem proxyzza közvetlenül. Kérések és válaszok külön HMAC-SHA256 hitelesítést kapnak, role/method/path/body/nonce kötés, 30 másodperces időkorlát és replay-védelem mellett.
- A helyi `.runtime/admin-helper-client/request.json` credential csak request szerepű; nincs áttekintési, megerősítési, törlési vagy teljes státuszlekérdezési képessége. A vezérlési kulcs nem kerül a böngészőbe, appba, Gitbe vagy az OpenCode normál felhasználójához.
- Az API aktuális owner-only RBAC, érvényes telefon és exact same-origin JSON ellenőrzést végez; nincs külső origin vagy tetszőleges mező/útvonal.

**Fontos meglévő korlát:** ez nem helyi támadók elleni teljes Windows-sandbox. A célok a már meglévő saját fiókjaik alatt futnak tovább (több közülük SYSTEM), és a NAS projektének írható kódját a fejlesztési munkafolyamat továbbra is engedi. A jóváhagyott restart azt a meglévő szolgáltatáskódot indítja újra. A szolgáltatások teljes read-only, védett kiadáskezelése és a helyi host teljes hardeningje külön feladat; ez a fejlesztés nem alakítja át őket. A Google-munkamenetet kezelő dashboard és a helyi operátor továbbra is a bizalmi kör része, a webes megerősítés nem UAC/passkey-szintű független hardveres jóváhagyás.

## Telepítés

1. Teljes `npm test`, typecheck, staging production build, majd a natív segéd tesztje:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\Test-AdminHelper.ps1`.
2. A teszt fordítja a production binárist `.runtime/admin-helper-build/WydrianAdminHelper.exe` alá; a release buildben nincs self-test/console mód. Csak a Windows .NET Framework 4.x/C# compiler szükséges, nincs NuGet vagy új runtime-letöltés.
3. **Egyszeri helyi UAC:** emelt PowerShellből `scripts\Install-AdminHelper.ps1 -ExpectedBinarySha256 <a tesztelt bináris SHA256 hash-e>`. Meglévő helper szolgáltatást, telepítési mappát és HTTP-reservationt nem ír felül. A védett másolat hashét ellenőrzi; a négy cél binárisútját előbb ellenőrzi. Mentett SCM-DACL, célhoz kötött minimum ACE; hibánál csak az általa hozzáadott ACE-ket távolítja el, a helper leáll/Disabled lesz, más admin módosításait nem törli.
4. A telepítő `.env.local`-ban kizárólag `ADMIN_HELPER_ENABLED=true` értéket állít. Aktiváld a tesztelt `.next-staging` buildet a meglévő, UAC-jóváhagyásos `Activate-Build.ps1` segítségével. Ez továbbra is külön adminművelet; a helper nem élesít kódot.
5. Ellenőrizd a nem-admin service accountot, localhost hallgatást, normál felhasználói vezérlésikulcs-/binárisírás-tiltást, request-only elutasításokat, anon/reader/más-admin tiltást. Egy valódi restartot a tulajdonos a felületen jóváhagyva ellenőrizzen.

Első élesítéshez a 3–4. lépést együtt elvégzi a helyi UAC-jóváhagyásos `scripts/Deploy-AdminHelper.ps1 -ExpectedBinarySha256 <hash>`. A korábbi env védett mentése és a dashboard aktiválásának konzisztens SQLite-mentése megmarad. Ez telepítési script, **nem** a segéd webes művelete. Sikertelen élesítésnél visszaállítja az env-et és Disabled állapotba teszi a segédet; nem ír felül meglévő helper-telepítést.

A telepítéshez nincs szükség Android-frissítésre. Az OpenCode webes jóváhagyás vagy egy kérés létrehozása nem helyettesíti a külön dashboard-megerősítést.

## Audit, mentés, hibák

Védett `data/audit-YYYY-MM.jsonl`: requested/reviewed/owner-confirmed/restart-started/restart-running/restart-failed/expired/cancelled/recovery események, időpont, kérés-ID, cél és számszerű Windows-hibakód. Nem naplóz credentialt, cookie-t, session-hash-t, promptot vagy parancstartalmat. A futó/queued állapot a mellékhatás előtt atomikusan, flush-sal lemezre kerül. Audit-/állapotírási hibánál nem indul új művelet. A havi audit 16 MiB fölött admin-karbantartást igényel, nem törlünk automatikusan előzményt.

A napi **SYSTEM** alkalmazásmentés a védett helper telepítését `.runtime/admin-helper-recovery` néven teszi a titkosított archívumba; a restore ezt D: alá bontja ki, **nem** telepíti vagy indítja privilegizált helyen. Friss gépen helyi UAC-jóváhagyásos újratelepítés/SCM-jogok és ACL-ek szükségesek. A helyreállított request-only credentialt ne használd automatikusan új vezérlési kulccsal; az újratelepítés előtt őrizd meg külön/átnevezve a régi mappát. A védett C: helper nyers másolatát soha ne tedd Gitbe vagy publikus letöltésbe.

Letiltás: emelt PowerShellből `Stop-Service WydrianAdminHelper`, majd `Set-Service WydrianAdminHelper -StartupType Disabled`; opcionálisan `ADMIN_HELPER_ENABLED=false` és dashboard újraindítás. Nem igényel UAC kikapcsolást vagy az OpenCode adminfiókra emelését. Bizonytalan/félbeszakadt restartot előbb szolgáltatásállapot alapján vizsgálj meg, ne ismételd automatikusan.
