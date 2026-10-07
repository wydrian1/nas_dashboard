# Szekciósorrend

Alapból a rendezőnyilak rejtve vannak: a tartalmi dobozok mobilon is a teljes
rendelkezésre álló szélességet használják. A lap tartalmának alján lévő
„Rendezőnyilak megjelenítése / elrejtése” kapcsoló minden dashboard-oldalon közös.
Bekapcsolva minden tartalmi blokk mellett, a tartalomtól jobbra kisebb fel/le gomb.
Egy kattintás egy helyet mozgat. A fejléc, navigáció és lábléc nem rendezhető tartalmi szekció.
Egyetlen blokk esetén mindkét gomb tiltott.

A láthatóság külön globális `localStorage` kulcsa: `wydrian:section-controls:v1`.
Csak a `true` érték kapcsolja be; hiányzó vagy sérült értéknél rejtve marad.
Oldalváltás és újratöltés után is megmarad, kikapcsolásig; az azonos eredetű nyitott
böngészőlapok is követik a változást. A kapcsoló nem törli a mentett szekciósorrendet,
és nem újítja meg a tartalmi komponenseket vagy az űrlappiszkozatokat.
Tiltott tárhely esetén az aktuális kliensmunkamenetben közös marad a láthatóság,
figyelmeztetéssel; teljes újratöltéskor nem garantálható a megőrzése.

Tárolás: `localStorage`, `wydrian:sections:v1:<oldal>`. Csak stabil blokkazonosítók;
nincs személyes adat, cookie, API-hívás vagy adatbázis-módosítás. Böngészőnként és
eredetenként külön sorrend: a két domain és az Android WebView nem szinkronizál.
Tiltott tárhely esetén az aktuális lapon működik, figyelmeztetéssel; újratöltéskor
alapsorrend. Sérült tárolt érték nem akadályozza a megjelenítést.

A DOM tényleges sorrendje változik, nem csak a CSS. A stabil kulcsok miatt az
űrlap és komponens állapota mozgatáskor megmarad. Az új blokkok a végére kerülnek;
átmenetileg hiányzó blokkok (üres gyorslinkek, megosztási űrlap) azonosítóját megtartjuk.
A szekciólinkek és jogosultságok nem változnak.

Alkalmazási oldalak: Dashboard, Hírolvasó, Konfig, Jegyzetek, Pénzügy (külön
összefoglaló/grafikon/reálgyarapodás/összetétel és változások/fordulók/tételek/gyűjtemények/bevitel),
Gyűjtemények, Fájlok, Pokémon (friss események és minden webshop), Fontos infók,
OpenCode. A nyilvános timeline kronológiai bemutató, nem személyes dashboard-elrendezés.

A pénzügyi vagyonösszetétel és legnagyobb változások együtt rendezhető, kétoszlopos
blokk. Keskeny képernyőn egymás alá törnek. A közös blokk megtartja a `composition`
azonosítót és annak korábban mentett helyét; a régi külön `movers` azonosító nem
hoz létre újabb blokkot. A többi szekció és oldal helyi sorrendje változatlan.
