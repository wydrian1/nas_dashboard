export const GAMERUNNER_URL = "https://gamerunner.hu/gyujtogetos-kartyajatekok/pokemon-tcg?stockfilter=1";
export const GAMERUNNER_ADAPTER_VERSION = "1.0.0";
export const MYTHGAMES_COLLECTION = "/collections/pokemon-kartyak-booster-boxok-es-gyujtoi-termekek";
export const MYTHGAMES_URL = `https://mythgames.eu${MYTHGAMES_COLLECTION}?filter.v.availability=1`;
export const POTTYOSZEBRA_CATEGORY = "/gyujtogetos-kartyajatekok-tcg/pokemon-trading-card-game-tcg";
export const POTTYOSZEBRA_URL = `https://pottyoszebra.hu${POTTYOSZEBRA_CATEGORY}?stockfilter=1`;
// Browser link retains the user's stock filter; the worker uses the robots-allowed catalog.
export const GRANDLINE_URL = "https://www.grandline.hu/pokemon/?stock=1";
export const GRANDLINE_CATALOG_URL = "https://www.grandline.hu/pokemon/";
export const KRODOMCARDS_FILTER = "category|284/manufacturer|80";
export const KRODOMCARDS_URL = `https://www.krodomcards.hu/index.php?route=filter&filter=${KRODOMCARDS_FILTER}`;
export const JATEKNET_URL = "https://www.jateknet.hu/gyujtheto-kartya?f=hid_165";
export const JATEKNET_CATALOG_URL = "https://www.jateknet.hu/gyujtheto-kartya";
export const REFLEXSHOP_URL = "https://reflexshop.hu/shop_search.php?search=pokemon+tcg&filter=product_status:in_stock";
export const GEEKEMPIRE_URL = "https://geekempire.hu/termekkategoria/kartya/pokemon-kartya/";
export const TCGFUTAR_CATALOG_URL = "https://tcgfutar.hu/spl/100003/Pokemon-TCG";
export const TCGFUTAR_URL = `${TCGFUTAR_CATALOG_URL}?infinite_page=4`;
export const SPORTKARTYABOLT_URL = "https://sportkartyabolt.hu/Pokemon-Kartya";
export const RTCOLLECTORSCLUB_COLLECTION = "/collections/pokemon-dobozok";
export const RTCOLLECTORSCLUB_URL = `https://rtcollectorsclub.com${RTCOLLECTORSCLUB_COLLECTION}?filter.v.availability=1&filter.v.price.gte=&filter.v.price.lte=&sort_by=best-selling`;
export const RTCOLLECTORSCLUB_CATALOG_URL = `https://rtcollectorsclub.com${RTCOLLECTORSCLUB_COLLECTION}?filter.v.availability=1`;
export const CARDVERSE_CATEGORY = "/termekkategoria/gyujtogetos-kartyajatekok/";
export const CARDVERSE_URL = `https://www.cardverse.hu${CARDVERSE_CATEGORY}?_stock=instock&_cat=gyujtogetos-kartyajatekok&_brand=pokemon-tcg&~1`;
export const METAGAMES_CATEGORY = '/gyujtogetos-kartyajatekok/pokemon-tcg';
export const METAGAMES_URL = `https://www.metagames.hu${METAGAMES_CATEGORY}?keszlet=csak-keszleten`;
export const TCGBOLT_CATEGORY = '/termekkategoria/pokemon/';
export const TCGBOLT_URL = `https://tcgbolt.hu${TCGBOLT_CATEGORY}`;
export const BLOOMRIFT_CATEGORY = '/Osszes-angol-termek';
export const BLOOMRIFT_URL = `https://bloomrift.eu${BLOOMRIFT_CATEGORY}`;
export const SHOP_IDS = ["gamerunner","mythgames","pottyoszebra","grandline","krodomcards","jateknet","reflexshop","geekempire","tcgfutar","sportkartyabolt","rtcollectorsclub","cardverse","metagames","tcgbolt","bloomrift"] as const;
export type ShopID = typeof SHOP_IDS[number];
export const SHOP_NAMES:Record<ShopID,string> = {gamerunner:'GameRunner',mythgames:'MythGames',pottyoszebra:'Pöttyös Zebra',grandline:'GrandLine',krodomcards:'Krodom Cards',jateknet:'JátékNet',reflexshop:'Reflexshop',geekempire:'GeekEmpire',tcgfutar:'TCG Futár',sportkartyabolt:'Sport Kártya Bolt',rtcollectorsclub:'RT Collectors Club',cardverse:'Cardverse',metagames:'Metagames',tcgbolt:'TCG Bolt',bloomrift:'Bloomrift'};
// Static, reviewed source registry; never derived from push data, request URLs or editable database rows.
export const SHOP_URLS:Record<ShopID,string> = {gamerunner:GAMERUNNER_URL,mythgames:MYTHGAMES_URL,pottyoszebra:POTTYOSZEBRA_URL,grandline:GRANDLINE_URL,krodomcards:KRODOMCARDS_URL,jateknet:JATEKNET_URL,reflexshop:REFLEXSHOP_URL,geekempire:GEEKEMPIRE_URL,tcgfutar:TCGFUTAR_URL,sportkartyabolt:SPORTKARTYABOLT_URL,rtcollectorsclub:RTCOLLECTORSCLUB_URL,cardverse:CARDVERSE_URL,metagames:METAGAMES_URL,tcgbolt:TCGBOLT_URL,bloomrift:BLOOMRIFT_URL};
export function isShopID(value:unknown):value is ShopID {return typeof value==='string' && SHOP_IDS.some(id=>id===value);}
export const DEFAULT_SCAN_INTERVAL_MINUTES=3;
export const MIN_SCAN_INTERVAL_MINUTES=3;
export const MAX_SCAN_INTERVAL_MINUTES=60;
export function validScanInterval(value:number):boolean {return Number.isInteger(value) && value>=MIN_SCAN_INTERVAL_MINUTES && value<=MAX_SCAN_INTERVAL_MINUTES;}
export type PokemonProduct = { externalID: string; sku: string; title: string; url: string; image: string | null; priceHuf: number | null; availability: "in_stock" | "preorder" | "available" };
export type ShopScan = { products: PokemonProduct[]; pages: number; total: number; scannedAt: number };
export type PokemonShop = {
  id: string; name: string; url: string; enabled: number; interval_minutes: number;
  notify_new: number; notify_restock: number; notify_preorder: number; emails_enabled: number;
  baseline_at: number | null; last_success: number | null; next_scan: number;
  lease_until: number; lease_owner: string | null; manual_requested: number;
  status: string; last_error: string | null; last_count: number;
  pending_drop: string | null; failure_count: number;
};
// in_stock records presence in the purchasable filtered list; availability distinguishes preorders.
export type StoredProduct = { external_id: string; title: string; url: string; sku: string; image: string | null; price_huf: number | null; availability: string; in_stock: number; missing_count: number; episode: number; first_seen: number; last_seen: number; last_queued: number | null };
export type PokemonEvent = { id: number; kind: string; title: string; url: string; price_huf: number | null; occurred_at: number; mail_state: string };
export type PokemonAggregateEvent = PokemonEvent & {shop_id:string;shop_name:string;image:string|null;stale?:boolean};
export type PokemonShopSnapshot = { shop: PokemonShop; health?:import('./health.ts').ShopHealth;products: StoredProduct[]; events: PokemonEvent[]; notifications?:import('./notifications.ts').NotificationSettings; mail: {id:string;kind:string;state:string;error:string|null;created_at:number}[] };
// Keep original GameRunner fields for existing private API consumers; mail/smtpConfigured are retired compatibility fields.
export type PokemonSnapshot = PokemonShopSnapshot & { shops:PokemonShopSnapshot[]; latestEvents:PokemonAggregateEvent[]; viewerRole?:import('../users.ts').Role; workerAlive:boolean; smtpConfigured:boolean };
