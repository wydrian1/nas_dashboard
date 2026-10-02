# REGIO JÁTÉK — teljes terméklista jelenleg nem igazolt

Elemzés: 2026-10-01.

Megadott link:
https://www.regiojatek.hu/index.php?action=webstore&query=pokemon%20tcg&type=ackeyword&ws_action=search

Robots és megadott keresőoldal HTTP 200. A robots csak néhány letölthető hírlevél/landing/katalógus mappát tilt. A válasz **Prefixbox keresőváz**, termékkártyák, igazolt találatszám és kosárgombok nélkül. Ezt nem tekintjük „0 készletes termék” eredménynek.

Normál nyilvános desktop-böngészőben is ellenőriztük a megadott oldalt, bejelentkezés, kosárba helyezés és védelemmegkerülés nélkül; a teljes betöltés után sem állt rendelkezésre igazolt terméklista. A site saját JSON-LD SearchAction útvonalából származó, `type` paraméter nélküli azonos „pokemon tcg” keresést is egyszer ellenőriztük: ugyanaz a termék nélküli váz. Nem találunk ki belső API-t vagy paramétert, és nem indítunk folyamatos Chromiumot.

**Nincs adapter, shopregisztráció, baseline vagy automatikus lekérés.** A forrás támogatása halasztva, amíg a teljes keresőlista, stabil termék-ID-k, lapozás és aktív Kosárba állapot megbízhatóan megfigyelhető.

Helyi diagnosztika: `.runtime/research/regiojatek-robots.txt`, `regiojatek-catalog.html`, `regiojatek-catalog-schema-search.html`.
