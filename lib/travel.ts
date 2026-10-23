import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

export const TRAVEL_HTML_LIMIT=2*1024*1024;
// No scripts, forms or same-origin privilege, even if a future document contains active content.
// External links may open a separate tab; remote images retain the supplied document's design.
export const TRAVEL_SANDBOX='allow-popups allow-popups-to-escape-sandbox';
export const TRAVEL_CSP="sandbox "+TRAVEL_SANDBOX+"; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: data:; frame-src 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'";
export const TRAVEL_HEADERS={
  'Content-Type':'text/html; charset=utf-8',
  'Cache-Control':'private, no-store',
  'Content-Security-Policy':TRAVEL_CSP,
  'X-Frame-Options':'SAMEORIGIN',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
};
export function readTravelItinerary(directory=join(process.cwd(),'data','travel')):string|null {
  const path=join(directory,'itinerary.html');
  try{
    const stat=statSync(path);
    if(!stat.isFile() || stat.size>TRAVEL_HTML_LIMIT)throw new Error('Az útiterv nem olvasható vagy túl nagy.');
    const document=readFileSync(path);
    if(document.length>TRAVEL_HTML_LIMIT)throw new Error('Az útiterv túl nagy.');
    return document.toString('utf8');
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
}
