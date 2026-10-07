# Automatikus, titkosított NAS-mentés

Aktív projekt: `D:\!nas`. Napi **03:00**, Windows helyi idő (Budapest), **30 napos megőrzés**. Feladat neve: `WydrianDailyBackup`, SYSTEM identitással; bejelentkezett Windows-felhasználó nélkül is fut. Kimaradt indításkor StartWhenAvailable; párhuzamos futás tiltva; hiba után legfeljebb 3 újrapróbálás, 30 percenként. A dashboard/HTTPS/Pokémon-szolgáltatásokat nem állítja le.

## Mit ment?

- SQLite **online backup API** pillanatkép, WAL-ban már commitolt adatokkal. Pénzügy, LEGO, szerepkörök, párosítások, értesítések, notes/todos/linkek és monitoring-előzmények együtt. Indulás előtt és próba-visszaállításkor SQLite integrity + manifest SHA-256 ellenőrzés.
- Alkalmazásforrások, package-lock és konfiguráció, `.env.local`, `data/caddy` TLS-tár, `.runtime/secrets` Firebase-kulcs, Android-aláírókulcsok és jelszó, kiadott APK-k, service-wrapper konfigurációk/binárisok.
- Fájlhosting: a SQLite metaadat/aláírtlink-állapot mellett a teljes dedikált `data/file-hosting` könyvtár is bekerül a titkosított mentésbe. A kész fájlok az alkalmazásból nem írhatók felül/törölhetők; a később keletkezett, snapshotban nem szereplő objektum nem válik publikussá visszaállításkor. Nagy feltöltések növelik a napi és 30 napos mentések tárhelyigényét/futásidejét. A forrásfrissítés/élesítés előtt az új tároló még nem része a régi mentőkódnak.
- Nem menti a `node_modules`, `.next*`, Android build/Gradle-cache, régi mentések, logok és SDK-k több gigabájtos, újra előállítható állományait. A visszaállított forrásból a webes build/függőségek újratelepítendők.
- A Google OAuth-token/config és a **mentés visszafejtőkulcsa nem kerül az archívumba**. A Drive-kapcsolat Google-belépéssel újrakészíthető; a visszafejtőkulcs viszont pótolhatatlan.

## Titkosítás és kulcs

A kész tar.gz archívum **AES-256-GCM** titkosítást kap, véletlen 256 bites kulccsal és mentésenként új nonce-szal, hitelesített ciphertexttel. `.nasbackup` formátum: `WYDNAS01` fejléc + 12 bájtos nonce + ciphertext + 16 bájtos GCM tag. Titkosított helyi archívumok: `.runtime/automatic-backups`; csak felhasználó, SYSTEM és rendszergazdák férnek hozzá, LocalService nem. A rövid életű plaintext staging a védett könyvtárban van, a futás végén törlődik. Minden mentést visszafejtünk és külön ideiglenes könyvtárba próbakibontunk, manifesttel és SQLite integrityvel ellenőrzünk.

**Kötelező külön, független helyre elmenteni:**

`D:\!nas\.runtime\backup-secrets\recovery-key.json`

USB-re vagy jelszókezelőbe; ne oszd meg, és ne töltsd fel titkosítatlanul. A RAID/Windows/projekt elvesztése után csak ezzel fejthetők vissza az archívumok. Nem Windows-fiókhoz kötött (nem DPAPI), így másik gépen is használható. A kulcs soha nem jelenik meg tool-/task-naplóban.

**Teljes szervervesztésre:** [docs/disaster-recovery.md](disaster-recovery.md). A `.runtime/backup-secrets/backup-recovery-kit.zip` önálló, npm-függőség nélküli helyreállítót és útmutatót tartalmaz, kulcs/titkok nélkül. Ezt is őrizd meg a szerveren kívül; új gépen Node 24 + tar elegendő a visszafejtéshez. Előállítása: `node --experimental-strip-types scripts\Build-RecoveryKit.ts`.

## Google Drive

Projektlokális, hivatalos rclone **v1.75.1**, a letöltött zip SHA-256 összevetve a hivatalos manifesttel. Külön Google-projekt és Desktop app OAuth-kliens a mentéshez, az eredeti dashboard-webklienst/push-t nem módosítjuk. Jogosultság kizárólag **drive.file**, az alkalmazás által létrehozott fájlokra; nem teljes Drive-hozzáférés. A közös rclone-kliens 2026-os kivezetése miatt saját kliens szükséges. A mentési OAuth-alkalmazás Production állapot szükséges a Testing token 7 napos korlátjának elkerüléséhez; a nem érzékeny drive.file scope nem igényel érzékeny adatjóváhagyást.

Csak már titkosított `.nasbackup` fájl kerül a **Wydrian-NAS-Backup** mappába. `copyto --immutable`, nem `sync`; minden feltöltést visszaolvasással SHA-256 ellenőrzünk. Korábbi offline/hibás feltöltések a következő futáskor újrapróbálódnak. Ezt követően csak az adott telepítés véletlen, egyedi azonosítójával kezdődő, pontosan időbélyeges, 30 napnál régebbi archívumok törölhetők a mentésmappából. Más Drive-fájlokhoz, kézi/deploy backupokhoz nem nyúl. Hiba esetén nincs felhős sikerjelzés, ellenőrizetlen helyi példányokat nem töröl.

## Telepítés és használat

```powershell
# Saját felhasználóként, titkos fájlok/mentéskönyvtár ACL-jével:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\Prepare-Backup.ps1
# Külön Desktop OAuth JSON, csak helyi fájlba, nem chatbe:
# .runtime\backup-secrets\google-oauth-client.json
node --experimental-strip-types scripts\Connect-GoogleBackup.ts
# Rendszergazdaként:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\Install-BackupTask.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\Test-BackupTask.ps1
# Drive-ról ténylegesen letöltött archívum teljes próba-visszaállítása:
node --experimental-strip-types scripts\Test-CloudBackup.ts
# Kézi futtatás:
node --experimental-strip-types scripts\Run-Backup.ts
```

`cloudEnabled=false` esetén csak helyi, titkosított és próba-visszaállított mentés készül. Ez **nem** Google Drive-backup. Sikeres OAuth + mentésmappa létrehozás után a kapcsolatbeállító kapcsolja true-ra. Állapot: `.runtime/automatic-backups/status.json`, futásonként `.nasbackup.receipt.json`; nincsenek tokenek vagy provider response-ok a naplóban. Ütemező ellenőrzési jelentése: `.runtime/research/backup-task-verified.json`.

## Visszaállítás — mindig új mappába

```powershell
node --experimental-strip-types scripts\Restore-Backup.ts --archive "D:\letoltott.nasbackup" --key "E:\offline-kulcs\recovery-key.json" --destination "D:\nas-restore"
```

A célmappa **nem létezhet**, az éles adatokat nem írja felül. Hitelesített visszafejtés, tar-útvonalellenőrzés, teljes manifest SHA-256 és SQLite integrity után a forrás/konfig visszaáll. Telepíts Node 24-et, állítsd át az abszolút projektútvonalakat (service XML, `.env.local`), `npm ci`, build, szolgáltatások/jogosultságok beállítása. A `.env.local`, Firebase-kulcsok, TLS-tár és Android signing fájlok ismét kapjanak védett ACL-t. Ne indíts egyszerre két workert ugyanarra az adatbázisra, és próba-visszaállításhoz ne küldj valós pushokat.
