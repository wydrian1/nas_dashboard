import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { initializeDatabase } from "../lib/db-schema.ts";
import { scanGamerunner } from "../lib/pokemon/adapters/gamerunner.ts";
import { scanMythgames } from "../lib/pokemon/adapters/mythgames.ts";
import { scanPottyoszebra } from "../lib/pokemon/adapters/pottyoszebra.ts";
import { scanGrandline } from "../lib/pokemon/adapters/grandline.ts";
import { scanKrodomcards } from "../lib/pokemon/adapters/krodomcards.ts";
import { scanJateknet } from "../lib/pokemon/adapters/jateknet.ts";
import { scanReflexshop } from "../lib/pokemon/adapters/reflexshop.ts";
import { scanGeekempire } from "../lib/pokemon/adapters/geekempire.ts";
import { scanTcgfutar } from "../lib/pokemon/adapters/tcgfutar.ts";
import { scanSportkartyabolt } from "../lib/pokemon/adapters/sportkartyabolt.ts";
import { scanRtcollectorsclub } from "../lib/pokemon/adapters/rtcollectorsclub.ts";
import { scanCardverse } from "../lib/pokemon/adapters/cardverse.ts";
import { scanMetagames } from "../lib/pokemon/adapters/metagames.ts";
import { SHOP_IDS } from "../lib/pokemon/types.ts";
import { claimScan, finishScan, failScan } from "../lib/pokemon/store.ts";
import { ShopRequestError } from "../lib/pokemon/fetch-policy.ts";
import { sendNextPush } from "../lib/mobile/push.ts";

mkdirSync('data',{recursive:true});
const database=new DatabaseSync('data/dashboard.sqlite');
initializeDatabase(database);
const shutdown=new AbortController();
process.on('SIGINT',()=>shutdown.abort());process.on('SIGTERM',()=>shutdown.abort());
console.log('Pokémon worker started; no browser or page view is required.');
while(!shutdown.signal.aborted){
  try {
    database.prepare("INSERT INTO pokemon_worker VALUES(1,?,'running') ON CONFLICT(id) DO UPDATE SET heartbeat=excluded.heartbeat,message=excluded.message").run(Date.now());
    for(const shopID of SHOP_IDS){
      if(shutdown.signal.aborted)break;
      const owner=claimScan(database,Date.now(),shopID);
      if(!owner)continue;
      try {
        const adapter={gamerunner:scanGamerunner,mythgames:scanMythgames,pottyoszebra:scanPottyoszebra,grandline:scanGrandline,krodomcards:scanKrodomcards,jateknet:scanJateknet,reflexshop:scanReflexshop,geekempire:scanGeekempire,tcgfutar:scanTcgfutar,sportkartyabolt:scanSportkartyabolt,rtcollectorsclub:scanRtcollectorsclub,cardverse:scanCardverse,metagames:scanMetagames}[shopID];
        const scan=await adapter(AbortSignal.any([shutdown.signal,AbortSignal.timeout(3*60_000)]));
        const result=finishScan(database,owner,scan);
        console.log(JSON.stringify({time:new Date().toISOString(),shop:shopID,count:scan.total,...result}));
      } catch(error) {
        const message=error instanceof Error ? error.message : 'Ismeretlen vizsgálati hiba.';
        failScan(database,owner,message,error instanceof ShopRequestError ? error.retryAfterMs : 0);
        console.error(shopID+' scan failed: '+message);
      }
      database.prepare("UPDATE pokemon_worker SET heartbeat=? WHERE id=1").run(Date.now());
    }
    database.prepare("UPDATE pokemon_worker SET heartbeat=? WHERE id=1").run(Date.now());
    if(!shutdown.signal.aborted)for(let i=0;i<10 && !shutdown.signal.aborted;i++)await sendNextPush(database);
  }catch{console.error('Pokémon worker storage or scheduling error; will retry.');}
  try{await delay(10_000,undefined,{signal:shutdown.signal});}catch{break;}
}
database.close();
