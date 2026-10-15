# NULLPONT ASCII-jelenetek tervezése

A játék kézzel ellenőrzött, monospaced ASCII-rajzot és külön célpont-koordinátákat
használ. Képkonvertálás vagy generatív modell nem tudja megbízhatóan garantálni,
hogy a játék összes interaktív eleme felismerhető és jó helyen kattintható lesz.

## Megvizsgált nyílt forrású lehetőségek

- [Chafa](https://github.com/hpjansson/chafa): kép → karakterrajz, LGPL-3.0-or-later.
  A `--symbols ascii --format symbols --colors none --size 80x28` beállítás jó
  kiindulópont az egyszerű, kontrasztos vázlatokhoz. A kimenetet kézzel tisztítsd,
  különösen ajtóknál és apró tárgyaknál. Nem ad interaktív célpontokat.
- [chafa-wasm](https://github.com/hectorm/chafa-wasm): Chafa WebAssembly-változat;
  szerkesztői prototípushoz használható. Integrálás előtt a wrapper és az alapkönyvtár
  licencét is ellenőrizni kell. Nem része a játékcsomagnak.
- [FLUX.1-schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell):
  Apache-2.0 képgeneráló modell, helyben futtatható; nem közvetlen ASCII-generátor.
  Opcionális munkafolyamat: egyszerű jelenetkép → Chafa → kézi szerkesztés.
  A NAS Intel HD Graphics 630 grafikája miatt ezt most nem telepítjük: a nagy modell
  megfelelő GPU/memória nélkül nem praktikus alapértelmezett fejlesztési függőség.

## Modulonkénti ellenőrzés

1. Az illusztráció a már megírt jelenethez készüljön, ne találjon ki új kánont.
2. Minden tárgy/környezeti elem és kijárat legyen a rajzon, `artSpots` célponttal.
   Közös ajtó- és kijárati célpont használhat `environment` és `exit` azonosítót is.
3. Csak felfedezés után látható részlethez `glyph` használható. A rajz alaprétege
   ne tartalmazzon rejtett tárgyat vagy történeti titkot.
4. Az `actions` általános igéket kínáljon, ne megoldást vagy kombinációs receptet.
   A játék ezeket egységes kis ikonokkal mutatja, tooltip/hozzáférhető név mellett.
   Az `arrivalDiscoveries` adja az érkezéskor látható alap környezetet; rejtett
   tárgyhoz továbbra is vizsgálati felfedezés tartozzon. A vizsgálat adjon konkrét
   érzéki/fizikai leírást, ne egy általános sikertelenségi üzenetet vagy megoldási
   parancsot. A sikertelen kísérlet legyen rövid, ne sorolja a nem történt károkat.
5. Az inventoryhoz rövid, egyértelmű `itemArt` készüljön. Stabil tárgyazonosítót
   és korábban megszerzett történetkönyvlapot nem szabad átírni.
6. Ellenőrizd a koordinátákat, keskeny képernyős görgetést, billentyűzetet,
   érintést, felfedezést, tárgyfelvételt, használatot és kombinálást.
7. A story steward jóváhagyása és az összes teszt a végső bájtokra vonatkozzon.

Nem töltünk le modellt, nem vezetünk be modellhívást játék közben, és privát
storyboard nem kerül külső szolgáltatáshoz vagy generált kép metaadataiba.
