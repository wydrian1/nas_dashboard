export const INFO_HTML_LIMIT=100_000;
export function infoLink(value:string):string|null {
  if(value.length>2048||/[\x00-\x20\x7f]/.test(value))return null;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!!url.hostname ? url.href : null;}catch{return null;}
}
