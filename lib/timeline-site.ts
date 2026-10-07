import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// This closed list is the entire public story, not a directory browsing facility.
export const timelineAssets=['style.css','presentation.js',...['mark','dashboard','architecture','pokemon','finance','mobile','collections','files','workflow'].map(name=>'assets/'+name+'.svg')];

export function timelineResponse(file='index.html'):Response {
  if(file!=='index.html' && !timelineAssets.includes(file))return new Response('Not found',{status:404});
  const bytes=readFileSync(join(process.cwd(),'docs/history-site',file));
  // Preserve the offline source while serving relative assets under canonical /timeline.
  const body=file==='index.html' ? bytes.toString('utf8').replace(/(src|href)="(assets\/[^"<>]+|style\.css|presentation\.js)"/g,'$1="/timeline/$2"') : new Uint8Array(bytes);
  const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'image/svg+xml';
  return new Response(body,{headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300','Referrer-Policy':'no-referrer'}});
}
