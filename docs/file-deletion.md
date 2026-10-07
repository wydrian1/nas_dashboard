# Fájltörlés

Fájlok → Törlés. Megerősítés után a kész fájl tartalma, adatbázis-bejegyzése és
**összes** megosztása törlődik (állandó, lejáró, lejárt, visszavont). Más fájl,
mappa és annak linkjei nem változnak. Csak admin, azonos eredetű DELETE-kérés.
Mappatörlés és aktív/félkész feltöltés törlése nem része ennek a funkciónak.

Tárolási határ: csak a hosting saját, opak ID-val tárolt normál fájlja törölhető.
Junction/symlink/hardlink, útvonalbejárás vagy eltérő méret hibát ad.
A fájl előbb saját könyvtárán belül átneveződik. Az adatbázis-törlés és audit egy
tranzakció; hibánál a fájl és linkek visszaállnak. Commit után a leválasztott
fájlt unlink szabadítja fel. Ha ez nem sikerül, a felület nem állít teljes sikert:
a linkek már nem működnek, de adminnak fel kell szabadítania a maradék tárhelyet.

A már letöltött másolatot nem lehet visszavonni. Egy már folyamatban lévő letöltés
az operációs rendszer viselkedésétől függően még befejeződhet. A régi linkkel új
letöltés nem indul. A korábbi audit megmarad.
