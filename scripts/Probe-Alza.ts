// Explicit one-shot operator check; never opens a database or sends notifications.
import {scanAlza} from '../lib/pokemon/adapters/alza.ts';
import {ShopRequestError} from '../lib/pokemon/fetch-policy.ts';
import {alzaBrowserHeadless} from '../lib/pokemon/alza-browser.ts';
if(process.argv.slice(2).join(' ')!=='--live')throw new Error('Usage: node scripts/Probe-Alza.ts --live (one authorized read-only scan)');
try{
  const scan=await scanAlza(AbortSignal.timeout(90_000));
  console.log(JSON.stringify({passed:true,source:'alza',headless:alzaBrowserHeadless(),total:scan.total,pages:scan.pages,noDatabase:true,noNotifications:true}));
}catch(error){
  console.error(JSON.stringify({passed:false,source:'alza',kind:error instanceof ShopRequestError?error.kind:'error',message:error instanceof ShopRequestError?error.message:'Az Alza-vizsgálat nem adott igazolt teljes listát.',noDatabase:true,noNotifications:true}));process.exitCode=1;
}
