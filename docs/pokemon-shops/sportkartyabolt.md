# Sport Kártya Bolt — Pokémon Kártya

Elemzés és sikeres élesítés: 2026-10-01. Az önálló worker csendes baseline-ja 9 elérhető terméket mentett, képpel és árral; állapot `ok`, e-mail kikapcsolva.

https://sportkartyabolt.hu/Pokemon-Kartya

Robots és kategória HTTP 200. A robots.txt csak Google-site-verification sort és saját sitemap hivatkozást tartalmaz, **nincs User-agent/Disallow csoport**: ez szabálymentes robots, nem teljes tiltás. Csak ennél az adapterben engedjük az ismert, saját sitemapot tartalmazó, nem HTML robots formát; hibaoldalt nem fogadunk el. Minimum 1500 ms szünet.

Teljes közvetlen adapterpróba: **9 elérhető termék egy oldalon**, 9 kép és HUF-ár. Külön pack és display termékek: `60114` és `60114-1` külön stabil SKU; nem csonkítjuk numerikus előtagra. A Mega Zygarde akciós ára 19 990 Ft, nem az áthúzott 20 990 Ft.

Adapter: `lib/pokemon/adapters/sportkartyabolt.ts`, verzió `1.0.0`, webshopkulcs `sportkartyabolt`; megosztott `unas-category.ts`/`catalog-scan.ts` csak az új adaptereknek.

- Pontos canonical és első h1 `Pokémon Kártya`, teljes egyező `.product-num` és `.product-num__start=1`, `.product-num__end=N` kötelező. A SEO-tartalom második h1-je nem kategóriaazonosító.
- Kártyák: `.page_artlist_list.products > article.product`; ID és SKU `data-sku`, egyező kártyaazonosító, terméklink, cart action és mennyiségmező. Saját HTTPS `/slug` terméklink.
- Aktív `button.product__cart-btn` „Kosárba” szöveggel = elérhető, a készletszöveg csak tájékoztat. Disabled/hidden gomb kizárva; ismert, kosárgomb nélküli `not-stock__text` állapot nem rendelhető. Nem végzünk kosárba helyezést.
- Akciós `.product__price-sale` az árforrás, másként `.product__price-base`; nem az egységár. Kép: saját `/img/`, lazy `data-src`, nem placeholder.

Csak robots és az adott kategória GET-je engedett. A jelenleg igazolt, teljes egyoldalas nézet támogatott. Ha lapozás/hiányos lista jelenik meg, a scan hibát jelez és megőrzi az előző állapotot, nem tekinti a részoldalt teljesnek. Önálló 10 perces ütemezés (5–60), saját csendes baseline/események/beállítások és levélsor; e-mail kikapcsolva. Tesztek: `tests/pokemon-new-shops.test.ts`; anonim minta: `tests/fixtures/pokemon/sportkartyabolt/catalog.html`.
