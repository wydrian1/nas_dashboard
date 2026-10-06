import {load} from 'cheerio';
import {INFO_HTML_LIMIT,infoLink} from './policy.ts';
export {INFO_HTML_LIMIT,infoLink};

export class ImportantInfoError extends Error {}
const allowed=new Set(['p','br','strong','b','em','i','u','s','h2','h3','ul','ol','li','blockquote','a']);
const blocked=new Set(['script','style','iframe','object','embed','svg','math','template','form','input','button','textarea','select','link','meta','img','audio','video','source']);
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
// Parse untrusted HTML and reconstruct a tiny allowlist. No styles, handlers, media or embed requests.
export function sanitizeInfoHtml(value:unknown):string {
  if(typeof value!=='string'||value.length>INFO_HTML_LIMIT)throw new ImportantInfoError('Legfeljebb 100 000 karakteres formázott szöveg menthető.');
  const $=load(value,{},false);let nodes=0;
  const render=(node:any,depth:number):string=>{
    if(++nodes>20_000||depth>80)throw new ImportantInfoError('Túl összetett formázás. Egyszerűsítsd a szöveget.');
    if(node.type==='text')return escape(node.data);
    if(node.type!=='tag')return '';
    const tag=String(node.name).toLowerCase();if(blocked.has(tag))return '';
    const children=(node.children||[]).map((child:any)=>render(child,depth+1)).join('');
    if(!allowed.has(tag))return tag==='div' ? '<p>'+children+'</p>' : children;
    if(tag==='br')return '<br>';
    if(tag==='a'){const href=infoLink(node.attribs?.href || '');return href ? '<a href="'+escape(href)+'" target="_blank" rel="noopener noreferrer">'+children+'</a>' : children;}
    return '<'+tag+'>'+children+'</'+tag+'>';
  };
  const html=$.root().contents().toArray().map(node=>render(node,0)).join('');
  if(html.length>INFO_HTML_LIMIT)throw new ImportantInfoError('A formázott szöveg túl hosszú.');
  return html;
}
