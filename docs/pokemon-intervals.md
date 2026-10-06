# Pokémon-figyelők: 3 perces alapgyakoriság

A tulajdonos kérésére mind a **13 webshop** ellenőrzési intervalluma **3 perc**. Az admin 3–60 perc közötti egész értéket állíthat be; a reader továbbra is csak saját értesítéseit kezeli. Új webshopok alapértéke is 3 perc.

## Meglévő adatbázis

Az egyszeri `three-minute-intervals-v1` migráció kiszélesíti a régi 5–60 perces SQLite CHECK-et 3–60-ra, 3-ra módosítja az alapértéket és minden webshop beállítását. Nem használ `writable_schema`-t: tranzakciós create/copy/drop/rename, megőrzött oszlopok/rowid/indexek/triggerek és idegenkulcs-ellenőrzés. Sikertelenségkor rollback, az eredeti foreign-key mód visszaállításával.

- Megmarad a termékállapot, baseline, esemény- és scan-előzmény, push-sor, párosítás, értesítési és engedélyezési beállítás, valamint minden nem Pokémon-adat.
- Egészséges, szabad figyelő következő időpontja legfeljebb az utolsó siker + 3 percre rövidül; nincs kényszerített manuális scan.
- Hiba/backoff/Retry-After, futó lease, szünetelés és már kért manuális vizsgálat időpontja változatlan. A rövidebb alapintervallum nem írja felül a forrás robots-késleltetését, a teljes lapozást vagy a hibák miatti várakozást.
- A migráció csak egyszer fut. Későbbi adminváltoztatásokat újraindításkor nem ír felül.

Az intervallum az előző teljes vizsgálat végétől számít; a közös soros worker és webshop-késleltetések miatt nem garantált a pontos falióra szerinti 180 másodperc. Workerhiba esetén az automatikus hosszabb várakozás megmarad.

## Ellenőrzés / élesítés

`tests/pokemon-intervals.test.ts`: friss és régi séma, 13 alapérték, beviteli korlátok, adatmegőrzés, backoff/lease/paused/manual védelem, idempotencia, rollback és 180 másodperces sikerütemezés. A valódi adminfelület minimumát a navigációs render-teszt ellenőrzi; az immutable worker-függőségeket külön release-tesztek vizsgálják.

Élesítés előtt teljes teszt/typecheck, `.next-staging` production build, izolált HTTP- és privát adatbázismásolaton migrációellenőrzés szükséges. Mentés és korábbi build visszaállítási lehetőség után a dashboard frissül. A futó worker minden sikeres vizsgálat/hibavárakozás végén az adatbázisból olvassa az intervallumot, ezért a 3 perces ütemezéshez nem szükséges új worker release vagy restart. HTTPS, helper és OpenCode sem indul újra. Android-kód/APK változás nem szükséges: az app a szerveroldali beállítást kapja.
