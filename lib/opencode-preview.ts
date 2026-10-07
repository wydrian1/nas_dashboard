import {mkdir,lstat,realpath,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,parse,relative,sep,extname,basename} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {OPENCODE_PREVIEW_CSP} from './opencode-preview-policy.ts';
export const previewRoot=()=>join(process.cwd(),'data','opencode-previews');
const types:Record<string,string>={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.html':'text/html','.htm':'text/html','.txt':'text/plain','.md':'text/plain','.csv':'text/plain','.ts':'text/plain','.tsx':'text/plain','.js':'text/plain','.css':'text/plain'};
export type OpenCodePreview={id:string;title:string;type:string;size:number;createdAt:number;sha256:string};
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
async function safeDirectory(path:string,create=false){
  const absolute=resolve(path);let current=parse(absolute).root;
  for(const part of relative(current,absolute).split(sep).filter(Boolean)){current=join(current,part);if(create)await mkdir(current).catch(error=>{if(error.code!=='EEXIST')throw error;});const stat=await lstat(current);if(!stat.isDirectory()||stat.isSymbolicLink()||resolve(await realpath(current)).toLowerCase()!==current.toLowerCase())throw new Error('Átirányított előnézet-tároló.');}
}
export async function listOpenCodePreviews(root=previewRoot()):Promise<OpenCodePreview[]>{
  try{await safeDirectory(root);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return [];throw error;}
  const {readdir}=await import('node:fs/promises'),result:OpenCodePreview[]=[];
  for(const name of (await readdir(root)).filter(name=>/^[a-f0-9]{32}\.json$/.test(name)).slice(0,100)){
    const file=join(root,name),stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>4096)throw new Error('Érvénytelen előnézet-jegyzék.');
    const item=JSON.parse(await readFile(file,'utf8')) as OpenCodePreview;
    if(item.id!==name.slice(0,32)||!Object.values(types).includes(item.type)||typeof item.title!=='string'||item.title.length>120||!Number.isSafeInteger(item.size)||item.size<0||item.size>8*1024*1024||!Number.isSafeInteger(item.createdAt)||!/^[a-f0-9]{64}$/.test(item.sha256))throw new Error('Érvénytelen előnézet-jegyzék.');result.push(item);
  }
  return result.sort((a,b)=>b.createdAt-a.createdAt);
}
export async function publishOpenCodePreview(source:string,title:string,root=previewRoot()){
  if(!title.trim()||title.length>120||/[\x00-\x1f]/.test(title))throw new Error('Adj meg egy rövid címet.');
  if(source.split(/[\\/]/).some(part=>/^\.env(?:\.|$)|^\.git$|^(secrets?|android-signing|backups?)$|^(password|credentials?|tokens?)(\.|$)/i.test(part)))throw new Error('Privát konfiguráció nem publikálható előnézetként.');
  const type=types[extname(source).toLowerCase()];if(!type)throw new Error('Nem támogatott előnézet-típus.');
  // Validate ancestors too; a harmless basename must not expose a linked secret.
  await safeDirectory(join(resolve(source),'..'));
  const stat=await lstat(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>8*1024*1024)throw new Error('Csak normál, legfeljebb 8 MB-os fájl publikálható.');
  const bytes=await readFile(source);if(bytes.length>8*1024*1024)throw new Error('Túl nagy előnézet.');await safeDirectory(root,true);
  if((await listOpenCodePreviews(root)).length>=30)throw new Error('Legfeljebb 30 előnézet tárolható.');
  const item:OpenCodePreview={id:randomBytes(16).toString('hex'),title:title.trim()||basename(source),type,size:bytes.length,createdAt:Date.now(),sha256:hash(bytes)};
  await writeFile(join(root,item.id+'.blob'),bytes,{flag:'wx',mode:0o600});await writeFile(join(root,item.id+'.json'),JSON.stringify(item),{flag:'wx',mode:0o600});return item;
}
export async function openCodePreviewResponse(id:string,root=previewRoot()){
  if(!/^[a-f0-9]{32}$/.test(id))return new Response('Not found',{status:404});
  const item=(await listOpenCodePreviews(root)).find(item=>item.id===id);if(!item)return new Response('Not found',{status:404});
  const file=join(root,id+'.blob'),stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==item.size)throw new Error('Az előnézet sérült.');
  const bytes=await readFile(file);if(hash(bytes)!==item.sha256)throw new Error('Az előnézet sérült.');
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':item.type+(item.type.startsWith('text/')?'; charset=utf-8':''),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':OPENCODE_PREVIEW_CSP}});
}
