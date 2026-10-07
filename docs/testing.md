# Release-tesztek

Nem a tesztesetek száma a fontos, hanem a lefedett hibák és a teljes idő.
Az aktuális teljes Node-suite körülbelül 10 másodperc. Fájlonként már párhuzamos
folyamatok futnak. A production build és az Android Gradle/lint ettől külön költség.

## Átfedések

- `finance-ui`, `navigation`, `file-hosting-ui`: egyes import-/guard-/linkellenőrzések
  ismétlődnek. Nem mind ugyanazt bizonyítja: számítás, renderelt HTML, session/CSRF
  HTTP-viselkedés és valódi böngészős állapot külön réteg.
- A forrásszöveg-tesztek nem helyettesítik a HTTP-próbát. A unit teszt nem
  helyettesíti a production buildet, az Android-lintet vagy az éles adatmegőrzést.
- A `docs/history-site.test.mjs` külön suite: offline állományok és navigáció.
  Nem kell második teljes `npm test`-et futtatni mellé ugyanazon változatlan forráson.
- Új forráscommit (például verzióemelés vagy merge) új ellenőrzés. Ennek eredménye
  nem vehető át bizonyíték nélkül egy korábbi commitból.

## Mostani változtatás

A TSX-tesztharnessek azonos komponensét egyszer transpile-oljuk egy folyamaton
belül, a hook-szimulációkat nem cache-eljük. Ez megszünteti az ismételt fordítást,
de egyetlen regressziós eset sem marad ki. Nem vágjuk le a biztonsági teszteket
pár másodpercért. A kötelező `npm test`, typecheck és staging build marad.

Mérés ugyanazzal a teljes suite-tal:

```powershell
node scripts/Profile-Tests.mjs
```

Wall-clock és 12 leglassabb eset, privát adat nélkül. A párhuzamos esettartamokat
nem szabad összeadni release-időként. A script hibás suite-nál hibakóddal áll le.
Később csak igazoltan ugyanazt lefedő, érdemi időt fogyasztó eset összevonása
indokolt; az ismételt élesítés vagy már lezárt csomag újraépítése nagyobb költség
lehet, mint az olcsó unit tesztek.
