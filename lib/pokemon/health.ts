import type {PokemonShop} from './types.ts';
export type ShopFailureKind='error'|'maintenance'|'protected'|'rate_limited';
export type ShopHealth={stale:boolean;reason:string;checkedAt:number|null};
export function shopHealth(shop:PokemonShop,workerAlive:boolean,now:number):ShopHealth {
  const stale=!workerAlive||!shop.enabled||shop.last_success===null||shop.last_success>now+60_000||shop.status==='warning'||shop.failure_count>0||now-shop.last_success>Math.max(15*60_000,shop.interval_minutes*3*60_000);
  return {stale,checkedAt:shop.last_success,reason:!workerAlive?'A háttérfigyelő életjele elavult.':!shop.enabled?'A figyelés szünetel.':shop.last_success===null?'Még nincs sikeres teljes ellenőrzés.':shop.last_success>now+60_000?'Az ellenőrzési időpont nem hiteles.':shop.status==='warning'?'A változás megerősítésre vár.':shop.failure_count>0?'Az utolsó ellenőrzés nem sikerült.':stale?'A sikeres ellenőrzés túl régi.':'Frissen ellenőrzött állapot.'};
}
export function interruptionRedirect(url:URL):ShopFailureKind|null {
  if(url.username||url.password||url.hash)return null;
  if(url.origin==='https://www.grandline.hu'&&url.pathname==='/hozzaferesi-vedelem/')return 'protected';
  if(url.origin==='https://www.krodomcards.hu'&&url.pathname==='/index.php'&&url.searchParams.get('route')==='common/maintenance')return 'maintenance';
  return null;
}
