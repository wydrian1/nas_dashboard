# Pénzügy

Privát, **csak adminnak** elérhető oldal: `/finance`. A reader menüjében nincs link, a közvetlen oldal WebView-ban is `/pokemon`-ra irányít; `/api/finance` reader esetén 403, bejelentkezés nélkül 401. Mindkét szerveroldali mentés külön `requireAdmin()` ellenőrzést végez, a napló szerzőjét az élő session adja. Pénzügyi adat nem kerül pushba, APK-ba, publikus fájlba vagy automatikus külső interfészre.

## Az Excel feldolgozása

- Forrás: a felhasználó által megadott `D:\vagyon.xlsx`, **csak olvasva**, megnyitott Excel mellett is read-sharinggel. A forrásfájlt nem módosítjuk.
- 58 havi állapot, 2021-12–2026-09; 41 külön tétel. A kétszer szereplő Lili/Bali sorok külön azonosítót és számozott nevet kapnak, nem összevonást.
- Cashflow: az egyedi vagyontételek/negatív DEBT-összegek kerülnek a havi egyenlegtáblába. Az alsó kategóriaösszesítőket **nem** importáljuk még egyszer egyenlegként.
- A hiányzó cella hiányzó egyenleg marad, nem feltételezett nulla. Az összesítésből kimarad; a UI „—”-t mutat. A nulla külön tárolt érték.
- Az Excel 2026-03-tól az összesítésbe a fejléc dátum-sorszámát is beleveszi. A felhasználó jóváhagyásával a fő összeg a valódi tételek összege; eredeti Excel-összeg, képlet és eltérés megmarad. 7 havi összesítés érintett.
- Az XLSX képleteit nem futtatjuk: az Excel által mentett számított értékeket olvassuk. Hiányzó cache, Excel-hiba, váratlan előjel vagy nem magyarázható összesítési eltérés esetén az import megáll.
- A sárga, számmal kitöltött gyerek-DEBT-cellák 6 kamatforduló-jelölést adnak. Üres, csak színezett cella nem esemény. A felhasználó megerősítette az éves ismétlődést; a sor utolsó/egyező jelöléseinek hónapját használjuk éves fordulóhónapként. Pontos nap és kamatláb nincs megadva, ezeket nem találjuk ki.
- Reálnövekedés: az eredeti éves adatok és infláció megmaradnak privát archívumként. A felületen kiemelt, csoportosított oszlopdiagram mutatja a nominális növekedést, inflációt és arányos reálnövekedést. Befizetés/kivét miatt a vagyongyarapodás nem befektetési hozam.
- Portfolió: a lap 5 megnevezést, de egyenlegeket nem tartalmaz. Forrásinformációként megmarad, nem növeli másodszor a vagyont.
- A nyers munkafüzet-XML-ek és képletek a `finance_imports.workbook_json` privát importarchívumban megmaradnak. Az API ezt nem adja vissza.

## UI és kézi bővítés

Alapnézet a legutolsó rögzített hónap. Minden hónap választható; előző/következő és legfrissebb gyorslink. Nettó vagyon, eszközök, DEBT, előző állapothoz és az előző év azonos hónapjához képesti változás. 12/24/teljes idősoros grafikon, elérhető havi adattáblával. Összetétel, változást meghatározó tételek, kamatfordulók és tételes összehasonlítás.

Az **Új hónap** űrlap kizárólag a négy **Lili/Bali DEBT** értékét másolja a legfrissebb állapotból. **Pokémon** a Collectrből, **LEGO** az aktuális listaösszegből töltődik elő; **minden más összegmező üres** (bankszámlák és egyéb tartozások is). Nem ment automatikusan. Hónap, tényleges állapotdátum, teljes egyenlegsor, megjegyzés, kézi kamatjóváírás-jelölés és kötelező ellenőrzési pipa. A kamatot a DEBT összegéhez kézzel kell hozzáírni; a jelölés önmagában semmilyen összeget nem módosít. A megtekintett régebbi hónap is módosítható, ott az összes mentett érték marad. Új számla/tétel hozzáadható, a korábbi hónapok változatlanok.

Kivételek az előző havi előkitöltéshez: **Ledger** és **eToro (stock)** új hónapnál üres USD-mező; **Pokémon** a nyilvános Collectr-profil `Estimated Portfolio Value` USD-értékéből indul. Mindháromnál választható Ft is; a deviza megváltoztatása kiüríti a mezőt, nem értelmezi át a régi összeget. Meglévő hónap szerkesztése mindig a tárolt Ft-adatokkal indul. A Collectr/árfolyam frissítés nem írja felül a kézzel módosított mezőket. Hiányzó USD-érték nem másolja vissza a régi Ft-ot; lezárt tételnél explicit 0 adható meg.

A vagyonösszetétel kategóriánkénti kördiagram, Ft-értékkel és százalékkal; a negatív tartozások külön jelennek meg. Az **Adatforrás és ellenőrzés**, eredeti Excel-összeg és képletjavítási magyarázat nincs a UI-ban; az eredeti forrásarchívum nem törlődik.

### LEGO-lista

A pénzügy legalján külön, admin-only aktuális nyilvántartás: készletszám, megnevezés, darabszám, Ft-egységár, beszerzési dátum; hozzáadás, szerkesztés és megerősített törlés. A megadott 19 tétel egyszeri, checksum-védett importból indul; a 3 `?` dátum ismeretlen (`NULL`) marad. Összeg = darabszám × egységár, egész századforintban. Ez beszerzési érték, nem piaci becslés.

**Minden új hónap LEGO-mezője a lista aktuális összegéből indul**, nem az előző havi értékből. A nulla összeg is előtöltődik, ha a lista kiürül. A már kézzel szerkesztett mezőt egy listafrissítés nem írja felül. Meglévő hónap szerkesztése a korábban mentett Ft-értéket tartja meg. A lista nem számolódik másodszor a vagyonhoz; módosítása önmagában nem változtat havi állapotot. A lista mindig aktuális, történelmi hónap megtekintésekor is ezt a jelölést kapja. Tranzakciós, verzióvédett mentés, soft-delete és külön `finance_lego_audit` biztosítja az előzményt. `scripts/Import-Lego.ts --input ...` írás nélkül ellenőriz; élesítéskor explicit adatbázis + `--commit` és előzetes SQLite-backup szükséges. Ismételt import nem írja felül a szerkesztéseket és nem hozza vissza a törölt sorokat.

## Automatikus külső adatok

- **ECB / Frankfurter**: USD/HUF és EUR/HUF a fejlécben, közzétételi dátummal. Új USD-értékek mentése szerveroldalon ellenőrzött, az űrlapon megjelenített napra lekért árfolyamon történik. Hamis kliensárfolyamot nem használunk, túl régi/jövőbeli dátum és nem publikált nap esetén nincs csendes helyettesítés. Csak Ft-egyenleg tárolódik; az auditban az árfolyam/dátum/provider szerepel, az eredeti USD-bevitel nem.
- **Collectr**: `https://app.getcollectr.com/showcase/profile/@wydrian`; kizárólag a publikus, USD-ben megjelenített portfólióösszeg. Nincs jelszó/API-kulcs; a pénzügyi egyenlegeket nem küldjük el.
- **KSH STADAT**: `ara0002.html` lezárt naptári éves átlagai és `ara0040.html` havi fogyasztóiár-indexe. Bankmonitor a próbakéréskor HTTP 500-at adott, ezért közvetlen hivatalos adatot használunk. Gördülő éves számítás ugyanannak a hónapnak az előző évi vagyonát és havi YoY CPI-jét párosítja: `(vagyon / előző évi vagyon) / (1 + infláció) - 1`. Az éves átlag, havi YoY, havi MoM és kumulált adat nem keverhető. Hiányzó hónapot nem becsülünk; jelenleg a legutolsó havi adat 2026-08, 1,3% YoY; lezárt 2025 éves átlag 4,4%. KSH-hibánál az importált éves adatokból számolt külön jelölt tartalék nézet használható.
- Megnyitáskor gyorsítótárazott automatikus letöltés, külön admin-only, no-store `/api/finance/market` frissítés. `FINANCE_EXTERNAL_FETCH_ENABLED=false` kikapcsolja a külső lekéréseket izolált/offline tesztekben. Forráshiba látható; külső adat csak űrlap-előkitöltés, történelmi állapotot sosem módosít automatikusan.

Mentés egyetlen `BEGIN IMMEDIATE` tranzakcióban, egész századforint-egységekben történik. A hónap verziója optimista konkurenciavédelmet ad: két nyitott lap vagy már létező hónap nem írhatja felül egymást csendben. Minden szerkesztésnél szerző, időpont, előtte/utána állapot kerül a `finance_audit` táblába. Importált eredeti összegek és forrásarchívum szerkesztéskor is megmaradnak.

## Import/telepítés

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\Read-FinanceWorkbook.ps1 -Path D:\vagyon.xlsx
# A projekt .runtime könyvtárában levő Node 24-gyel:
node --experimental-strip-types scripts/Import-Finance.ts --input .runtime/research/finance-workbook.json
# Explicit cél és --commit nélkül nincs adatbázisírás.
node --experimental-strip-types scripts/Import-Finance.ts --input .runtime/research/finance-workbook.json --database data/dashboard.sqlite --commit
```

Commit előtt teljes SQLite-backup készül. Azonos forrás-checksum ismétlése no-op; megváltozott munkafüzet nem írhat felül már létező pénzügyi adatokat. A későbbi hónapokhoz a kézi űrlapot használjuk; új Excel-import/összefésülés és banki/investment interfészek külön, későbbi fejlesztések. Nincs jelenleg automatikus szinkron vagy banki hitelesítő adat.

UAC-s élesítés: `scripts/Deploy-Finance.ps1` importálja a már ellenőrzött pillanatképet, majd aktiválja a staging buildet az eredeti build-rollbackkel. A Pokémon workerhez most nem kell új release; a **későbbi** workertelepítés már másolja a `lib/finance` schema-függőséget is.

Már importált pénzügy frissítésekor csak `scripts/Activate-Build.ps1` fut; nincs újraimportálás vagy egyenlegmódosítás.

A LEGO-listát is hozzáadó frissítés wrapperje: `scripts/Deploy-Finance-Update.ps1`; a felhasználó megadott listáját backup után importálja, majd aktiválja a tesztelt buildet. Korábbi Excel-/havi adatok újraimportálása nincs.

## Későbbi interfészek

Stabil számlaazonosító + hónap + deviza/egység + állapotdátum + adatforrás alapján bővíthető. Következő lépésként külön draft/importjóváhagyás, külső provider-azonosítók, idempotens batch-ek, valutaátváltási adatforrás, tranzakciók/befizetések és tényleges hozam számítása adható hozzá. Ezek most nem működnek és nem igényelnek hozzáférési kulcsokat.

Tesztelés: `tests/finance.test.ts`, `tests/finance-ui.test.ts`, navigációs és izolált HTTP-jogosultsági regressziók. Valós Excel-feldolgozás elkülönített SQLite-on, production tesztfiók/JWT nélkül. Éles megőrzési ellenőrzés: `.runtime/research/verify-finance-deployment.ts`.

2026-10-02: **148 unit/regressziós teszt, típusellenőrzés és production build sikeres**. A 20 izolált HTTP-ellenőrzés tartalmazza a pénzügyi oldal/API reader-tiltását, admin általi valódi havi form-POST-ot, auditot és ismételt/stale mentés védelmét; natív reader-sessionnel is tiltott a pénzügyi hozzáférés. A valódi Excel mind az 58 hónapja külön SQLite-on egyeztetve, minden eredeti tétel és állapotdátum megőrizve. Böngészős ellenőrzésben 58 hónap a választóban, 41 teljes űrlapmező, működő teljes idősoros váltó és legrégebbi havi nézet; új hónap bevitelének alapja történelmi megtekintéskor is a legfrissebb állapot. Az előnézeti szerver csak localhostos/olvasási sandbox volt, az ellenőrzés után leállítva. Jelentések a privát `.runtime/research` alatt: `finance-excel-verified.json`, `roles-http-verified.json`.

Élesítve UAC-jóváhagyással (exit 0); utóellenőrzés: `2026-10-02T21:05:10.259Z`. Mind az 58 havi állapot, 41 tétel, 6 jelölés, éves adatok és forrásarchívum betöltve és egyeztetve; korrigált tételes összegek a főértékek. Eredeti role-ok, értesítési preferenciák, notes/todos/linkek, webshopbeállítások/baseline-ok, mobilpárosítás/token és APK változatlanok. Nincs production tesztfiók vagy szintetikus pénzügyi mentés. Az anonim hozzáférés tiltott; minden szolgáltatás Running, worker heartbeat friss. Jelentés: `.runtime/research/finance-deployed.json`.

2026-10-03 (UTC szerinti próba: 2026-10-02 22:08): a bővített változat **167 teszten**, production típusellenőrzésen/builden és **23 izolált HTTP-jogosultsági/CRUD ellenőrzésen** átment. Élő, izolált HTTP-próba igazolja a Collectr-/LEGO-előtöltést, kizárólag Lili/Bali DEBT továbbvitelét, a többi űrlapmező ürességét, mindhárom USD-mező szerveroldali Ft-mentését, hamis kliensárfolyam figyelmen kívül hagyását, stale árfolyam tiltását és a korábbi havi adatok változatlanságát. A menü Dashboard/Hírolvasó sorrendje, Konfig alá költözött telefonkezelés, reader/native tiltások és a LEGO hozzáadás/szerkesztés/törlés auditja is tesztelt. A 19 LEGO-tétel teljesen egyeztetett, összeg **500 793 Ft**, 3 ismeretlen dátum. A pénzügyi/menü/LEGO-bővítés első éles utóellenőrzése `2026-10-02T22:02:37.111Z`; a végső előtöltési szabály külön aktiválás után ugyanazzal a megőrzési ellenőrzéssel vizsgálandó. Jelentések: `finance-market-deployed.json`, `finance-usd-http-verified.json`, `roles-http-verified.json` a privát `.runtime/research` alatt. Az Android APK változatlan.

A végleges újhónap-előtöltési szabály is élesítve, UAC exit 0; a megőrzési és élő forrásellenőrzés sikeres: `2026-10-02T22:10:27.152Z`. Ezután az egész projekt `D:\!nas` alá került, újabb teljes megőrzési ellenőrzéssel; részletek: [project-move.md](project-move.md). A korábban mentett havi pénzügyi állapotokat nem módosítottuk.
