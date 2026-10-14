import {readFileSync,lstatSync,existsSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {nullpontInstalledDirectory,verifyNullpontDeployment,queueNullpontDeployment} from '../lib/deployment/nullpont-announcement.ts';

// Explicit operator-only CLI. No environment file, FCM credentials, API, migrations or sender.
try{
  const args=process.argv.slice(2),names=['--evidence','--evidence-sha256','--commit','--manifest-sha256','--release'];
  if(args.length!==10||!names.every((name,i)=>args[i*2]===name))throw new Error('Usage: Announce-Nullpont-Deployment.mjs --evidence <private-file> --evidence-sha256 <sha256> --commit <approved-commit> --manifest-sha256 <approved-manifest-sha256> --release <installed-absolute-directory>');
  const root='D:\\!nas',privateRoot=resolve(root,'.runtime'),evidence=resolve(args[1]),releaseDirectory=nullpontInstalledDirectory(args[9]);
  function privatePath(path){if(!isAbsolute(path)||relative(privateRoot,path).startsWith('..')||relative(privateRoot,path)===''||relative(privateRoot,path).includes(':'))throw new Error('Private runtime path required');let current=path;while(current!==privateRoot){if(lstatSync(current).isSymbolicLink())throw new Error('Linked private path rejected');current=resolve(current,'..');}if(realpathSync(path)!==resolve(path))throw new Error('Private path identity mismatch');}
  privatePath(evidence);
  if(!lstatSync(releaseDirectory).isDirectory()||lstatSync(releaseDirectory).isSymbolicLink()||realpathSync(releaseDirectory)!==releaseDirectory)throw new Error('Installed NULLPONT root identity mismatch');
  if(!lstatSync(evidence).isFile()||lstatSync(evidence).nlink!==1||lstatSync(evidence).size>64*1024)throw new Error('Private evidence file rejected');
  const verified=verifyNullpontDeployment(readFileSync(evidence,'utf8'),{evidenceSha256:args[3],commit:args[5],manifestSha256:args[7],releaseDirectory});
  const database=resolve(root,'data/dashboard.sqlite');
  if(!existsSync(database)||lstatSync(database).isSymbolicLink()||realpathSync(database)!==database||lstatSync(database).nlink!==1)throw new Error('Existing live dashboard database required');
  const db=new DatabaseSync(database);try{db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000');console.log(JSON.stringify({application:'nullpont',adminReleasePushQueued:queueNullpontDeployment(db,verified)}));}finally{db.close();}
}catch{console.error('NULLPONT announcement rejected; inspect approval/evidence/package/schema privately. No automatic resubmission.');process.exitCode=1;}
