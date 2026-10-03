import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createOpenCodeGateway } from '../lib/opencode-gateway.ts';
const config=JSON.parse(readFileSync(resolve('.runtime/opencode-gateway/settings.json'),'utf8'));
if(typeof config.serviceStateFile!=='string')throw new Error('Missing OpenCode service state path');
const server=createOpenCodeGateway({dashboardUrl:'http://127.0.0.1:3000',upstream:()=>{
  const state=JSON.parse(readFileSync(config.serviceStateFile,'utf8'));
  if(state.url!=='http://127.0.0.1:49374')throw new Error('OpenCode must remain on the expected loopback origin');
  return {url:state.url,password:state.password};
}});
server.listen(3101,'127.0.0.1',()=>console.log('Owner-only OpenCode gateway listening on loopback port 3101'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
