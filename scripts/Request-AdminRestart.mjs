// Request-only credential: this CLI cannot approve or execute a privileged operation.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adminTarget,HELPER_ORIGIN,helperHeaders,verifyHelperResponse } from '../lib/admin-helper/protocol.ts';
const target=adminTarget(process.argv[2]);
if(process.argv.length!==3)throw new Error('Usage: node scripts/Request-AdminRestart.mjs <dashboard|https|pokemon|opencode-gateway>');
const {key}=JSON.parse(await readFile(resolve('.runtime/admin-helper-client/request.json'),'utf8'));
const body=JSON.stringify({target,requestedBy:'OpenCode / helyi kérés'}),path='/v1/request';
const headers=helperHeaders('POST',path,body,key,'request');
const response=await fetch(HELPER_ORIGIN+path,{method:'POST',headers,body,redirect:'manual',signal:AbortSignal.timeout(7000)});
if(!response.ok)throw new Error(`The helper rejected the request (HTTP ${response.status}); nothing was approved.`);
const responseBody=await response.text();
if(responseBody.length>16384 || !verifyHelperResponse(response.status,responseBody,key,'request',headers['X-Nas-Nonce'],response.headers.get('X-Nas-Response')))throw new Error('The helper response could not be authenticated. No approval was sent.');
const result=JSON.parse(responseBody);
console.log(JSON.stringify({id:result.job.id,target,state:result.job.state,approvalUrl:'https://nas.wydrian.hu/config#admin-helper',message:'Only a request was created. The owner must review and explicitly confirm it in the dashboard.'}));
