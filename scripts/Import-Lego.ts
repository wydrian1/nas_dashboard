import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { initializeFinance } from '../lib/finance/schema.ts';
import { importLego, readLego } from '../lib/finance/lego.ts';

const args=process.argv.slice(2),option=(name:string)=>{const i=args.indexOf(name);return i>=0 ? args[i+1] : undefined;};
const input=option('--input');if(!input)throw new Error('--input is required');
const rows=JSON.parse(readFileSync(resolve(input),'utf8')),commit=args.includes('--commit'),target=option('--database');
if(commit && !target)throw new Error('Explicit --database is required for --commit');
const db=new DatabaseSync(commit ? resolve(target!) : ':memory:');
try{
  if(commit){const directory=join(dirname(resolve(target!)),'backups');mkdirSync(directory,{recursive:true});await backup(db,join(directory,'before-lego-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite'));}
  initializeFinance(db);const inserted=importLego(db,rows,option('--actor') || 'user-approved-lego-import');
  const snapshot=readLego(db);console.log(JSON.stringify({committed:commit,inserted,itemCount:snapshot.items.length,quantity:snapshot.quantity,totalMinor:snapshot.totalMinor,unknownDates:snapshot.items.filter(item=>item.acquired_on===null).length}));
}finally{db.close();}
