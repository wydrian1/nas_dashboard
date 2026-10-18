import type {PokemonShopSnapshot,StoredProduct} from '../lib/pokemon/types.ts';

export function filterPokemonTitles<T extends {title:string}>(items:T[],query:string):T[] {
  const term=query.trim().toLowerCase();
  return items.filter(item=>item.title.toLowerCase().includes(term));
}

export function searchAvailablePokemon(shops:PokemonShopSnapshot[],query:string,shopID='all') {
  if(!query.trim())return [];
  // Search the current catalog, not the capped, 24-hour event feed. Baseline
  // products without any event are searchable too; known missing cards are not.
  const results:(StoredProduct&{shop_id:string;shop_name:string;stale:boolean})[]=[];
  for(const {shop,products,health} of shops){
    if(shopID!=='all'&&shop.id!==shopID)continue;
    for(const product of filterPokemonTitles(products,query))if(product.in_stock===1&&product.missing_count===0)results.push({...product,shop_id:shop.id,shop_name:shop.name,stale:health?.stale??true});
  }
  return results.sort((a,b)=>a.title.localeCompare(b.title,'hu')||a.shop_name.localeCompare(b.shop_name,'hu')||a.external_id.localeCompare(b.external_id));
}
