import {copyFileSync,existsSync,mkdirSync,readFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {TRAVEL_HTML_LIMIT} from '../lib/travel.ts';

const args=process.argv.slice(2);
if(args.length!==1 || !args[0])throw new Error('Usage: node --experimental-strip-types scripts/Import-Travel-Itinerary.mjs <HTML file>');
const source=resolve(args[0]),directory=resolve('data','travel'),destination=join(directory,'itinerary.html');
if(!statSync(source).isFile() || statSync(source).size>TRAVEL_HTML_LIMIT)throw new Error('Expected an HTML file of at most 2 MiB.');
const content=readFileSync(source);
if(!/<!doctype\s+html|<html\b/i.test(content.toString('utf8')) || content.length>TRAVEL_HTML_LIMIT)throw new Error('Not an HTML document.');
if(existsSync(destination))throw new Error('An itinerary already exists; preserve/review it before replacing.');
mkdirSync(directory,{recursive:true});
copyFileSync(source,destination,1); // COPYFILE_EXCL: never overwrite existing private data.
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(hash(readFileSync(destination))!==hash(content))throw new Error('Imported file verification failed.');
console.log(JSON.stringify({imported:true,bytes:content.length,sourceUnchanged:true}));
