import {Readable} from 'node:stream';
import type {DatabaseSync} from 'node:sqlite';
import type {HostedEntry} from './types.ts';
import {HostingError} from './types.ts';
import {openHostedFile} from './storage.ts';

export function fileRange(value:string|null,size:number):{start:number;end:number}|null {
  if(value===null)return null;
  const match=/^bytes=(\d*)-(\d*)$/.exec(value);if(!match||(!match[1]&&!match[2])||size===0)throw new HostingError('Érvénytelen byte-tartomány.',416);
  let start:number,end:number;
  if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)throw new HostingError('Érvénytelen byte-tartomány.',416);start=Math.max(0,size-suffix);end=size-1;}
  else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)throw new HostingError('Érvénytelen byte-tartomány.',416);end=Math.min(end,size-1);}
  return {start,end};
}
export function fileDownloadHeaders(entry:HostedEntry) {
  // ASCII fallback plus RFC 5987 original name. Never trust an uploaded MIME type.
  const encoded=encodeURIComponent(entry.name).replace(/['()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
  return new Headers({'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${encoded}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','Accept-Ranges':'bytes'});
}
let active=0;const perFile=new Map<string,number>();
export async function hostingDownload(db:DatabaseSync,entry:HostedEntry,request:Request,root?:string):Promise<Response> {
  const headers=fileDownloadHeaders(entry);let range;
  const etag=entry.sha256?'"'+entry.sha256+'"':null;if(etag)headers.set('ETag',etag);
  const ifRange=request.headers.get('if-range'),rangeHeader=ifRange&&ifRange!==etag?null:request.headers.get('range');
  try{range=request.method==='HEAD'?null:fileRange(rangeHeader,entry.size);}catch(error){if(error instanceof HostingError&&error.status===416){headers.set('Content-Range','bytes */'+entry.size);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}throw error;}
  if(active>=12||(perFile.get(entry.id)||0)>=4)throw new HostingError('Túl sok párhuzamos letöltés. Próbáld később.',429);
  active++;perFile.set(entry.id,(perFile.get(entry.id)||0)+1);let released=false;
  const release=()=>{if(released)return;released=true;active--;const n=(perFile.get(entry.id)||1)-1;if(n)perFile.set(entry.id,n);else perFile.delete(entry.id);};
  let handle;
  try{
    handle=await openHostedFile(db,entry,root);headers.set('Content-Length',String(range?range.end-range.start+1:entry.size));
    if(range)headers.set('Content-Range',`bytes ${range.start}-${range.end}/${entry.size}`);
    if(request.method==='HEAD'||entry.size===0){await handle.close();release();return new Response(null,{headers});}
    const stream=handle.createReadStream({...range,autoClose:true});stream.once('close',release);stream.once('error',release);
    const abort=()=>stream.destroy();request.signal.addEventListener('abort',abort,{once:true});stream.once('close',()=>request.signal.removeEventListener('abort',abort));if(request.signal.aborted)stream.destroy();
    return new Response(Readable.toWeb(stream,{strategy:{highWaterMark:64*1024,size:(chunk:Uint8Array)=>chunk.byteLength}}) as ReadableStream<Uint8Array>,{status:range?206:200,headers});
  }catch(error){if(handle)await handle.close().catch(()=>{});release();throw error;}
}
