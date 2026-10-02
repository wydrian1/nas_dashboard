import { TCGFUTAR_CATALOG_URL } from "../types.ts";
import { tcgfutarFetchUrl } from "../fetch-policy.ts";
import { catalogScanner } from "./catalog-scan.ts";
import { parseUnasCategory } from "./unas-category.ts";

export const TCGFUTAR_ADAPTER_VERSION='1.0.0';
export const parseTcgfutarPage=(html:string,page=1)=>parseUnasCategory(html,{name:'TCG Futár',url:TCGFUTAR_CATALOG_URL,heading:'Pokémon TCG',spd:true},page);
export const scanTcgfutar=catalogScanner({name:'TCG Futár',url:TCGFUTAR_CATALOG_URL,policy:tcgfutarFetchUrl,parse:parseTcgfutarPage,mode:'cumulative',pageParam:'infinite_page'});
