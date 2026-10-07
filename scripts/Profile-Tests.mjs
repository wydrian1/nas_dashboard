// Non-production test timing. TAP is parsed only for timing and status, not code.
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const files=readdirSync('tests').filter(name=>name.endsWith('.test.ts')).sort().map(name=>'tests/'+name),start=performance.now();
const result=spawnSync(process.execPath,['--experimental-strip-types','--test','--test-reporter=tap',...files],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,env:{...process.env,FINANCE_EXTERNAL_FETCH_ENABLED:'false'}});
const output=result.stdout||'',tests=[...output.matchAll(/# Subtest: ([^\r\n]+)\r?\n(?:ok|not ok) [^\r\n]+\r?\n\s+---\r?\n\s+duration_ms: ([\d.]+)/g)].map(match=>({name:match[1],ms:Number(match[2])}));
console.log(JSON.stringify({passed:result.status===0,wallMs:Math.round(performance.now()-start),files:files.length,cases:tests.length,slowest:tests.sort((a,b)=>b.ms-a.ms).slice(0,12)},null,2));
if(result.status!==0){console.error('Full test suite failed; inspect npm test output.');process.exitCode=1;}
