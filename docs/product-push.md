# Pokémon termékpush

A payload az esemény termék-URL-jét és webshopazonosítóját tartalmazza.
Android 1.1.1 (versionCode 8) termékpushból közvetlenül a telefon alapértelmezett
böngészőjébe küldi az URL-t, nem az app figyelőoldalára és nem a webshop-appba.
Ha nincs kiválasztott alapböngésző, a rendszer böngészőválasztója jelenik meg.

Csak az érintett webshop pontos HTTPS hostja (www-változat is), hitelesítési
adat és idegen port nélkül. Ismeretlen/más webshop vagy hibás URL esetén az app
figyelőoldala a biztonságos fallback. Intent/script/file/http séma nem engedett.
Release push továbbra is az appba, határidő-push a jegyzetekhez megy.
Dedup, értesítési csatornák, párosítás és saját beállítások változatlanok.

A régi APK ignorálja az új mezőket és a megtartott belső `path` szerint nyit.
A funkcióhoz az új APK **és** worker élesítése kell; puszta webes kiadás nem elég.
A build/unit/lint nem valódi telefonos alapböngésző-próba; ez a kiadási kézi
ellenőrzés része. Most csak forrás és tesztelt build készül, nem élesítés.
