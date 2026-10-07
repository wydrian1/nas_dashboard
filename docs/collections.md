# Gyűjtemények és gyarapodás

`/collections`: **csak adminoknak** elérhető LEGO- és Pokémon-bekerülési nyilvántartás. A menüpont a Pénzügy után szerepel; a Pokémon-reader és info-reader menüjében nincs ott. Oldal/API/szerverakció egyaránt a session szerepét ellenőrzi, privát adatok olvasása vagy írása előtt. `/api/collections` nem ad audit/importarchívumot; anonim 401, nem admin 403, privát/no-store válasz. A natív reader sem kap kivételt.

## Nyilvántartások

- A LEGO-kezelés a pénzügyi oldalról ide költözött. Ugyanazokat a `finance_lego_items`, `finance_lego_audit`, `finance_lego_imports` táblákat használja: nincs másolás, újraimport, azonosító-/ár-/dátumváltoztatás vagy előzményvesztés.
- Pokémon: megnevezés, darabszám, egész Ft-egységár és vásárlás dátuma. Összeg = db × egységár. Ismétlődő termék vagy akár azonos vásárlási sor külön rekord marad; eltérő árak/dátumok nem keverednek. Nem a Collectr piaci értékét tároljuk itt.
- Mindkettőnél hozzáadás, szerkesztés és megerősített soft-delete, tranzakciós mentés, optimista verzióvédelem, sessionből származó szerző és előtte/utána audit. A havi pénzügyi egyenleg és kamatjelölés változatlan marad.
- A kézi egységárból szóköz/vessző/pont elválasztóként törlődik, az adat egész Ft. A régi LEGO-import és tárolt adatok eredeti pontossága megmarad. Hiányzó dátum `NULL`, nem helyettesítjük mai vagy feltételezett dátummal.
- Új hónapnál a havi LEGO-mező a publikus BrickEconomy-profil **Current value** piaci becsléséből indul Ft-ban; a havi Pokémon-mező továbbra is Collectr-előtöltés. Forráshibánál a LEGO-mező üres/kézzel megadható, nincs bekerülési összeggel való helyettesítés. Egyik lista sem növeli másodszor a vagyont és nem ment automatikusan pénzügyi állapotot. A helyi lista nem ír a BrickEconomy-gyűjteménybe; azt külön kell naprakészen tartani.

## Pénzügyi összefoglaló

A `/finance` oldalon a **havi állapot rögzítése fölött** a **Gyűjtemény gyarapodás** két külön kártya: Pokémon és LEGO. Mindkettő külön mutatja a **legutóbbi mentett havi állapothoz** és az **aktuálisan lekért piaci becsléshez** tartozó nominális/reálgyarapodást, valamint a piaci érték eltérését az utolsó mentett értéktől. Korábbi pénzügyi hónap megtekintése a mentett összehasonlítást nem változtatja át a régi hónapra, és a friss piaci adatot sem állítjuk be történelmi adatként.

- Havi tény: a már tárolt Pokémon/LEGO Ft-egyenleg. A hiányzó érték nem nulla, a valódi nulla viszont veszteséget is mutathat.
- Piaci becslés: Pokémonnál **Collectr Estimated Portfolio Value**, LEGO-nál **BrickEconomy Owned Sets → Current value**. Collectr teljes USD-centpontosságú értékét az aktuálisan lekért ECB/Frankfurter USD/HUF árfolyammal váltjuk át századforintra; itt nem az űrlap egész USD-re lefelé kerekített előtöltését használjuk. BrickEconomy eleve Ft-forrás, nem igényel árfolyamot. Forráslink, UTC-lekérési idő és Collectrnél árfolyam/árfolyamdátum látható. A számítás állapotdátuma az adott forrás lekérésének UTC-napja.
- Az oldal betöltése és a meglévő kézi piaci lekérés közös piaci adatát használjuk, a meglévő forrásérték-gyorsítótárral (legfeljebb öt perc; árfolyam legfeljebb 15 perc); nincs külön második szolgáltatói kérés. A sikeres kézi lekérés a kártyákat is frissíti, szerkesztési módban is, de nem ment havi adatot. Forráshibánál csak az érintett piaci összehasonlítás hiányzik; árfolyam nélkül a Collectr Ft-összehasonlítás nem számolható. Nem helyettesítjük régi egyenleggel vagy bekerüléssel; a mentett összehasonlítás továbbra is látható.
- Bekerülés: az aktuális, nem törölt gyűjteménylistából az állapotdátumig megvásárolt tételek összege. Későbbi vásárlást kizárunk és jelzünk. Nem történelmi készletrekonstrukció: a lista későbbi javítása/törlése az összehasonlítás alapját módosíthatja, a mentett havi vagyonadatot nem.
- Nominális gyarapodás: `adott mentett vagy piaci érték − az adott állapotdátumig számolt bekerülés`, százalék: `gyarapodás / bekerülés`.
- Inflációval korrigált bekerülés: vásárlási soronként a vásárlás hónapját **követő** hónaptól legfeljebb az állapot hónapjáig láncolt KSH havi **MoM** indexek (`ár × db × Π(1 + MoM)`), századforintra kerekítve. Ha az állapot hónapja még nem érhető el, az utolsó elérhető hónapnál megállunk (például októberi állapothoz szeptemberig). Nem ismételjük az utolsó rátát a még nem publikált hónapokra. A vásárlás havi árszint az alap; napi árindex/napi arányosítás nincs. Nem használunk éves átlagot vagy YoY-indexet erre a láncolásra. A kártya kiírja az inflációs cutoffot.
- Reálgyarapodás: `adott mentett vagy piaci érték − korrigált bekerülés`, százalék: `reálgyarapodás / korrigált bekerülés`. Az adott állapot havi Ft-értékben mutatjuk a vásárlóerő-korrigált nyereséget/veszteséget.
- Hiányzó vásárlási dátumnál az **adott összehasonlítás állapotdátumához képest egy évvel korábbi** vásárlást feltételezünk kizárólag a számításban (február 29. évfordulója február 28.). A kártya kiírja az érintett sorok számát és a feltételezett dátumot. A forrásban `NULL` marad, nincs dátum-/audit-/haviadat-írás. A nominális bekerülés változatlan. A közzétett idősoron **belüli** szükséges index hiánya, hibája vagy kétértelműsége továbbra is „Nem számolható”; nem gyártunk indexet. Azonos havi vagy az inflációs cutoff utáni vásárláshoz nem alkalmazunk korábbi hónapokra inflációt.
- Üres nyilvántartásból nem feltételezünk ingyen megszerzett gyűjteményt/nyereséget. Nulla bekerülésnél százalékot nem osztunk nullával. A két számítás kizárólag tájékoztató, nem új vagyonösszeg vagy automatikus hozamkönyvelés.
- A külső portfóliók tartalma eltérhet a helyi vásárlási listától. A piaci becslés és a mentett értéktől való eltérés önmagában nem befektetési hozam; a forrásértékek nem kerülnek automatikusan a mentett havi vagyonba.

## Privát kezdő feltöltés

Az owner képéből ellenőrzött sorokat **ignorált privát JSON** tartalmazza, nem forrásfájl/GitHub/nyilvános artifact. A generikus import mezői szövegesek: `name`, `quantity`, `unit_price`, `acquired_on` (`YYYY-MM-DD`, vagy üres).

```powershell
node --experimental-strip-types scripts/Import-PokemonCollection.ts --input <privát-json>
# Alapesetben memóriabeli próba, nincs adatbázisírás.
# A tesztelt élesítéshez külön engedély, explicit meglévő cél és előzetes backup:
node --experimental-strip-types scripts/Import-PokemonCollection.ts --input <privát-json> --database data/dashboard.sqlite --commit --actor <jóváhagyó>
```

Commit előtt konzisztens SQLite-backup készül. Tranzakciós/checksum-védett import: azonos lista ismétlése no-op, eltérő lista nem írhat felül meglévő vagy soft-deleted rekordokat. Nincs automatikus kezdőadat-beültetés alkalmazásindításkor. Az új schema csak üres Pokémon-nyilvántartás/audit/import táblákat hoz létre; a meglévő LEGO- és pénzügyi táblákhoz nem nyúl.
