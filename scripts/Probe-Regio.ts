// Explicit bounded read-only live diagnostic. No database, baseline, event or notification writes.
import {scanRegio} from '../lib/pokemon/adapters/regio.ts';
import {ShopRequestError} from '../lib/pokemon/fetch-policy.ts';
if(process.argv.length!==3||process.argv[2]!=='--live')throw new Error('Usage: node scripts/Probe-Regio.ts --live');
try{const scan=await scanRegio(AbortSignal.timeout(90000));console.log(JSON.stringify({passed:true,source:'regio',total:scan.total,pages:scan.pages,images:scan.products.filter(product=>product.image).length,noDatabase:true,noNotifications:true}));}
catch(error){console.log(JSON.stringify({passed:false,source:'regio',kind:error instanceof ShopRequestError?error.kind:'error',message:error instanceof ShopRequestError?error.message:'A REGIO-vizsgálat nem adott igazolt teljes listát.',noDatabase:true,noNotifications:true}));process.exitCode=1;}
