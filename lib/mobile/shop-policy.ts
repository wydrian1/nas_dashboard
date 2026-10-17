import {SHOP_IDS,SHOP_URLS} from '../pokemon/types.ts';

// Only reviewed source URLs may grant external navigation. Editable DB rows and push payloads cannot.
export function mobileShopPolicy(){
  return {version:1,shops:SHOP_IDS.map(id=>{
    if(id==='alza')return {id,hosts:['m.alza.hu']};
    const host=new URL(SHOP_URLS[id]).hostname.replace(/^www\./,'');
    return {id,hosts:[host,'www.'+host]};
  })};
}
