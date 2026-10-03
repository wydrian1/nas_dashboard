// Local credential setup only. No network, trades, service restart or database writes.
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEtoroCredentials } from '../lib/finance/etoro.ts';
try{
  if(process.argv.length!==3)throw new Error();
  const text=await readFile(resolve(process.argv[2]),'utf8');
  let credentials;
  try{credentials=parseEtoroCredentials(text);}catch{
    // Owner-supplied format: user key, blank lines, Public: label, application key.
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
    if(lines.length!==3 || !/^public\s*:$/i.test(lines[1]))throw new Error();
    credentials=parseEtoroCredentials(JSON.stringify({userKey:lines[0],apiKey:lines[2]}));
  }
  await mkdir(resolve('.runtime/secrets'),{recursive:true});
  await writeFile(resolve('.runtime/secrets/etoro.json'),JSON.stringify(credentials),{encoding:'utf8',flag:'wx'});
  console.log('eToro credentials configured in the private runtime directory. No credential values were printed. Set FINANCE_ETORO_ENABLED=true when activating the tested release. Use a Real + Read key only.');
}catch{console.error('eToro setup failed: check the input format and private runtime permissions. An existing credential file is never overwritten. No credentials were printed.');process.exitCode=1;}
