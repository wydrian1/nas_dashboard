import type {DatabaseSync} from 'node:sqlite';
import {load} from 'cheerio';
import {requireAccess} from './users.ts';
import {isShopID} from './pokemon/types.ts';
export type SearchResult={kind:string;title:string;preview:string;href:string};
export function globalSearch(db:DatabaseSync,email:string,input:unknown):SearchResult[]{
  const role=requireAccess(db,email,'mobile-self');
  if(typeof input!=='string'||input.trim().length<2||input.length>80||/[\x00-\x1f]/.test(input))return [];
  const query=input.trim(),pattern='%'+query.replace(/[\\%_]/g,'\\$&')+'%',results:SearchResult[]=[];
  if(role==='admin'){
    for(const row of db.prepare("SELECT title,content FROM notes WHERE title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 10").all(pattern,pattern))results.push({kind:'Jegyzet',title:String(row.title),preview:String(row.content).slice(0,160),href:'/notes'});
    for(const row of db.prepare("SELECT text FROM todos WHERE text LIKE ? ESCAPE '\\' AND owner_email=? ORDER BY updated_at DESC LIMIT 10").all(pattern,email.toLowerCase()))results.push({kind:'Teendő',title:String(row.text),preview:'Saját feladat',href:'/notes'});
    for(const row of db.prepare("SELECT name,parent_id,kind FROM hosted_entries WHERE state='ready' AND name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 10").all(pattern))results.push({kind:row.kind==='folder'?'Mappa':'Fájl',title:String(row.name),preview:'Privát tároló',href:'/files'+(row.parent_id&&/^[a-f0-9]{32}$/.test(String(row.parent_id))?'?folder='+String(row.parent_id):'')});
    for(const [table,kind,anchor]of [['finance_lego_items','LEGO','lego'],['finance_pokemon_items','Pokémon gyűjtemény','pokemon']])for(const row of db.prepare(`SELECT name FROM ${table} WHERE deleted_at IS NULL AND name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 10`).all(pattern))results.push({kind,title:String(row.name),preview:'Bekerülési nyilvántartás',href:'/collections#'+anchor});
  }
  if(role!=='pokemon-reader'){
    const row=db.prepare('SELECT html FROM important_info WHERE id=1').get();
    if(row){const page=load(String(row.html));page('script,style,template').remove();const text=page.text().replace(/\s+/g,' ').trim(),index=text.toLocaleLowerCase('hu').indexOf(query.toLocaleLowerCase('hu'));if(index>=0)results.push({kind:'Fontos infók',title:'Fontos infók',preview:text.slice(Math.max(0,index-40),index+120),href:'/important-info'});}
  }
  if(role!=='info-reader')for(const row of db.prepare("SELECT title,shop_id FROM pokemon_products WHERE title LIKE ? ESCAPE '\\' AND in_stock=1 ORDER BY title LIMIT 10").all(pattern))if(isShopID(row.shop_id))results.push({kind:'Készletfigyelő',title:String(row.title),preview:'Utolsó ismert készlet; frissesség a bolt paneljén',href:'/pokemon#shop-'+row.shop_id});
  return results.slice(0,50);
}
