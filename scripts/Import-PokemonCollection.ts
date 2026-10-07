import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { initializeFinance } from '../lib/finance/schema.ts';
import { importPokemonCollection, readPokemonCollection } from '../lib/finance/pokemon-collection.ts';

const args=process.argv.slice(2),option=(name:string)=>{const i=args.indexOf(name);return i>=0 ? args[i+1] : undefined;};
const input=option('--input');if(!input)throw new Error('--input is required');
const rows=JSON.parse(readFileSync(resolve(input),'utf8')),commit=args.includes('--commit'),target=option('--database');
if(commit && (!target || !existsSync(resolve(target))))throw new Error('Explicit existing --database is required for --commit');
// Validate all private rows before touching a target database or creating a backup.
const preview=new DatabaseSync(':memory:');
try{initializeFinance(preview);importPokemonCollection(preview,rows,'validation-only');}finally{preview.close();}
const db=new DatabaseSync(commit ? resolve(target!) : ':memory:');
try{
  db.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000');
  if(commit){
    const directory=join(dirname(resolve(target!)),'backups');mkdirSync(directory,{recursive:true});
    const path=join(directory,'before-pokemon-collection-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite');await backup(db,path);
    const saved=new DatabaseSync(path,{readOnly:true});try{if(saved.prepare('PRAGMA integrity_check').get()!.integrity_check!=='ok' || saved.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Pre-import backup integrity verification failed');}finally{saved.close();}
  }
  initializeFinance(db);const inserted=importPokemonCollection(db,rows,option('--actor') || 'user-approved-pokemon-collection-import');
  const snapshot=readPokemonCollection(db);console.log(JSON.stringify({committed:commit,inserted,itemCount:snapshot.items.length,quantity:snapshot.quantity,totalMinor:snapshot.totalMinor,unknownDates:snapshot.items.filter(item=>item.acquired_on===null).length}));
}finally{db.close();}
