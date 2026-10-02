import { readFile,mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,dirname,join } from 'node:path';
import { decryptArchive,command,verifyStage } from '../lib/backup.ts';
const args=process.argv.slice(2),option=(name:string)=>{const i=args.indexOf(name);return i>=0 ? args[i+1] : undefined;},source=option('--archive'),keyPath=option('--key'),destination=option('--destination');
if(!source || !keyPath || !destination)throw new Error('--archive, --key and a NEW --destination directory are required. Never restore over the live project.');
const target=resolve(destination);await mkdir(target); // Refuse to overwrite any existing directory.
let work:string|undefined;
try{
  if(process.platform==='win32'){const user=(await command('whoami.exe',[])).trim();await command('icacls.exe',[target,'/inheritance:r','/grant:r',`${user}:(OI)(CI)F`,'*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F']);}
  work=await mkdtemp(join(target,'.restore-work-'));const archive=join(work,'snapshot.tar.gz'),key=JSON.parse(await readFile(resolve(keyPath),'utf8')).key;
  await decryptArchive(resolve(source),archive,key);
  const names=(await command('tar.exe',['-tzf',archive])).split(/\r?\n/).filter(Boolean);
  if(names.some(name=>name.startsWith('/') || name.includes('\\') || name.includes(':') || name.split('/').includes('..')))throw new Error('Unsafe archive paths');
  const entries=(await command('tar.exe',['-tvzf',archive])).split(/\r?\n/).filter(Boolean);if(entries.some(entry=>entry[0]!=='-' && entry[0]!=='d'))throw new Error('Archive links and special files are not allowed');
  await command('tar.exe',['-xzf',archive,'-C',target]);const manifest=await verifyStage(target);console.log(JSON.stringify({restoredTo:target,filesVerified:manifest.files.length,sqliteIntegrityVerified:true,productionUntouched:true}));
}finally{if(work)await rm(work,{recursive:true,force:true});}
