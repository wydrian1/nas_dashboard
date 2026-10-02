import { SPORTKARTYABOLT_URL } from "../types.ts";
import { sportkartyaboltFetchUrl } from "../fetch-policy.ts";
import { catalogScanner } from "./catalog-scan.ts";
import { parseUnasCategory } from "./unas-category.ts";

export const SPORTKARTYABOLT_ADAPTER_VERSION='1.0.0';
export const parseSportkartyaboltPage=(html:string)=>parseUnasCategory(html,{name:'Sport Kártya Bolt',url:SPORTKARTYABOLT_URL,heading:'Pokémon Kártya',spd:false});
export const scanSportkartyabolt=catalogScanner({name:'Sport Kártya Bolt',url:SPORTKARTYABOLT_URL,policy:sportkartyaboltFetchUrl,parse:parseSportkartyaboltPage,mode:'single',ruleFreeRobots:true});
