import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {join} from 'node:path';
import {DEPLOYMENT_ID,digest,deploymentSignature,deploymentResult} from '../lib/deployment/protocol.ts';
const id=process.argv[2];if(process.argv.length!==3||!DEPLOYMENT_ID.test(id))throw new Error('Usage: node scripts/Request-Deployment.mjs <prepared-id>');
const {key}=JSON.parse(readFileSync('.runtime/deployment-client/deploy.json','utf8')),directory=join('.runtime/deployment/inbox',id),manifest=readFileSync(join(directory,'manifest.json')),time=String(Date.now()),hash=digest(manifest);
writeFileSync(join(directory,'request.json'),JSON.stringify({id,time,hash,signature:deploymentSignature(id,time,hash,key)}),{flag:'wx'});
for(let attempt=0;attempt<180;attempt++){
  const path=join('.runtime/deployment/results',id+'.json');if(existsSync(path)){
    const result=deploymentResult(readFileSync(path,'utf8'),key);if(result.id!==id)throw new Error('Wrong result id');
    if(!['accepted','running'].includes(result.state)){console.log(JSON.stringify(result));if(result.state!=='succeeded')process.exitCode=1;break;}
  }
  if(attempt===179)throw new Error('Deployment result timed out; inspect signed result before retrying. Never resubmit this job.');
  await delay(2000);
}
