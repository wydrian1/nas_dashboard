import { readFile,mkdir,mkdtemp,writeFile,rm,rename } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { command,fileHash } from '../lib/backup.ts';
const root=process.cwd(),directory=join(root,'.runtime/backup-secrets'),work=await mkdtemp(join(directory,'recovery-kit-build-'));
try{
  const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext};
  for(const [source,name] of [['lib/backup.ts','backup.mjs'],['scripts/Restore-Backup.ts','restore.mjs']]){
    const code=(await readFile(join(root,source),'utf8')).replace("'../lib/backup.ts'","'./backup.mjs'");
    await writeFile(join(work,name),ts.transpileModule(code,{compilerOptions:options}).outputText);
  }
  await writeFile(join(work,'HELYREALLITAS.md'),await readFile(join(root,'docs/disaster-recovery.md'),'utf8'));
  await writeFile(join(work,'SHA256SUMS.txt'),(await Promise.all(['backup.mjs','restore.mjs','HELYREALLITAS.md'].map(async name=>(await fileHash(join(work,name)))+'  '+name))).join('\n')+'\n');
  const destination=join(directory,'backup-recovery-kit.zip'),temporary=destination+'.new.zip';
  await command('powershell.exe',['-NoProfile','-Command',`Compress-Archive -LiteralPath '${work.replaceAll("'","''")}\\backup.mjs','${work.replaceAll("'","''")}\\restore.mjs','${work.replaceAll("'","''")}\\HELYREALLITAS.md','${work.replaceAll("'","''")}\\SHA256SUMS.txt' -DestinationPath '${temporary.replaceAll("'","''")}' -Force`]);
  await rename(temporary,destination);console.log('Standalone recovery kit created: '+destination+'. No recovery key or OAuth credential is included.');
}finally{await rm(work,{recursive:true,force:true});}
