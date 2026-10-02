# Projekt átköltöztetése RAID-meghajtóra

Cél: `D:\!nas`. Az eredeti `C:\Users\Wydrian\Documents\Default Project` könyvtár a sikeres ellenőrzés után is megmarad visszaállítási példányként; nem ez az aktív adatbázis/projekt. Ne indítsd egyszerre a két példányt. A RAID nem helyettesít egy külön, lehetőleg másik eszközön levő biztonsági mentést.

`scripts/Move-Project.ps1` rendszergazdaként, az eredeti projektből futtatva:

1. Meglévő célkönyvtárat nem ír felül; ellenőrzi a három Wydrian-szolgáltatás és a HTTPS-tűzfalszabály tulajdonát.
2. Védett jogosultságú célkönyvtárba előmásolja a teljes projektet (függőségek, Node, Android-eszközök, buildmentések, privát források is).
3. Leállítja csak a `WydrianPokemon`, `WydrianDashboard`, `WydrianHttps` szolgáltatásokat, konzisztens SQLite-backupot és megőrzési manifestet készít, majd átmásolja az utolsó adatokat/certifikátumokat/naplókat is.
4. Indulás előtt minden fájl méretét és a kritikus fájlok (SQLite/adatmentések, TLS-tár, APK, aláírókulcsok, FCM-kulcs, OAuth-konfig) SHA-256 egyezését ellenőrzi. Privát értékeket nem ír a jelentésbe.
5. A cél szolgáltatás-XML-jeiben és `.env.local`-ban átírja a projekt gyökérútvonalát, az SCM executable-útvonalakat és a programhoz kötött 443-as tűzfalszabályt is átállítja. A szolgáltatásfiókokat nem módosítja, nem nyit új portot, nem változtat IIS-/médiaszolgáltatáson.
6. Újraindítja a szolgáltatásokat; ellenőrzi a HTTPS-t, védett útvonalakat, worker heartbeatet, pénzügy/LEGO, szerepkörök, párosítások/tokenek, saját beállítások megőrzését. Sikertelen indulásnál visszaállítja az eredeti indítási útvonalakat és tűzfalszabályt; az új példány közben létrejött adatváltozásait nem dobja el.

A célkódban LocalService olvasási jogosultságot kap; a `data`, `logs`, `.next/cache` írható. Az Android-aláírókulcsok külön védettek, LocalService nem kap olvasási jogot hozzájuk. A régi mappába `MOVED-TO-D.txt` figyelmeztetés kerül.

Migrációs napló: a jóváhagyó felhasználó `AppData\Local\Temp\opencode\project-move-*` könyvtára. Megőrzési jelentés a cél privát `.runtime/research/project-move-verified.json` fájljában. A további szerkesztést, buildet, mentést és service-karbantartást a `D:\!nas` könyvtárban kell végezni; az OpenCode-munkamenetet is ide kell áthelyezni.

**Sikeresen végrehajtva 2026-10-03 00:14:43-kor (Budapest; UTC: 2026-10-02T22:14:43.531Z), UAC exit 0.** Mindhárom szolgáltatás Running, executable-útvonaluk `D:\!nas\.runtime\services\…`; a HTTPS-tűzfalszabály programja `D:\!nas\.runtime\caddy\caddy.exe`. Eredeti szolgáltatásfiókok megmaradtak. Teljes fájlméret-manifest és kritikus SHA-256 ellenőrzés sikeres, SQLite integrity és pénzügy/LEGO/szerepkörök/beállítások/párosítások megőrzése igazolt. HTTPS, védett útvonalak és worker heartbeat rendben. Az OpenCode-munkamenet aktív munkakönyvtára is `D:\!nas`. A C:-s eredeti mappát nem töröltük, kizárólag rollback-példány.
