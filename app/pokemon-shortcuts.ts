import type {PokemonShop} from '../lib/pokemon/types.ts';
import type {ShopHealth} from '../lib/pokemon/health.ts';

// Paused sources and a first pending scan are not failures. Keep a failed source
// highlighted while retrying, until a successful snapshot clears its old failure.
export function pokemonShortcutNeedsAttention(shop:Pick<PokemonShop,'enabled'|'status'|'failure_count'|'last_success'>,health:ShopHealth|undefined,workerAlive:boolean):boolean {
  if(!shop.enabled||shop.status==='paused')return false;
  return !workerAlive||['error','maintenance','protected','rate_limited','warning'].includes(shop.status)||shop.failure_count>0||shop.last_success!==null&&health?.stale===true;
}
