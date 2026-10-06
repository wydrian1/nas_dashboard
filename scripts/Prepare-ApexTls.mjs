// Does not restart services or request certificates. EAB/private TLS files never enter source artifacts.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {parseZeroSslEab,zeroSslSnippet} from '../lib/tls/zerossl-eab.ts';
if(process.cwd()!=='D:\\!nas'||process.argv.length!==2)throw new Error('Run only from the active D: project');
const path='.runtime/secrets/zerossl-apex.caddy',snippet=zeroSslSnippet(parseZeroSslEab(readFileSync('cert/eam','utf8')));
if(existsSync(path)){if(readFileSync(path,'utf8')!==snippet)throw new Error('Existing private issuer differs; refusing overwrite');}else writeFileSync(path,snippet,{flag:'wx'});
const user=process.env.USERDOMAIN+'\\'+process.env.USERNAME;
execFileSync('icacls.exe',[path,'/inheritance:r','/grant:r',user+':F','*S-1-5-18:F','*S-1-5-32-544:F'],{stdio:'pipe',windowsHide:true});
const baseline='.runtime/research/apex-caddy-before.txt';
if(!existsSync(baseline))writeFileSync(baseline,execFileSync('.runtime/git/cmd/git.exe',['show','origin/main:deploy/Caddyfile'],{encoding:'utf8'}),{flag:'wx'});
console.log(JSON.stringify({prepared:true,eabStoredPrivately:true,freeAcme:true,http01Only:true,noServiceChanges:true}));
