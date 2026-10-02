# CollectKing — hozzáférés jelenleg nem igazolt

Elemzés: 2026-10-01.

https://collectking.hu/termekkategoria/pokemon/?yith_wcan=1&instock_filter=1

A robots.txt HTTP 200, a megadott URL a személyes statikus figyelő robots-szabálya szerint engedett. A normál, nyílt kategória-GET azonban **HTTP 403** választ adott. A lekérést nem ismételtük más identitással, proxyval, cookie-val vagy böngészős botvédelmi megkerüléssel.

**Nincs adapter, baseline, shopregisztráció vagy automatikus lekérés.** Nem mutatunk hamis „0 elérhető” eredményt. A forrás akkor folytatható, ha a szolgáltató engedett nyilvános hozzáférést biztosít, vagy külön jóváhagyott normál böngészős vizsgálat alapján megbízható és megengedett megoldás áll rendelkezésre. SMTP bekapcsolását ez nem érinti.

Helyi diagnosztika: `.runtime/research/collectking-robots.txt`; a 403-as kategóriaválaszt nem mentettük katalógusként.
