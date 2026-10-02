import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { importFinanceWorkbook, parseFinanceWorkbook, type WorkbookPackage } from '../lib/finance/workbook.ts';

const args=process.argv.slice(2),arg=(name:string)=>args[args.indexOf(name)+1];
if(!args.includes('--input'))throw new Error('Usage: --input exported-workbook.json [--database file.sqlite --commit]');
const input=JSON.parse(readFileSync(resolve(arg('--input')),'utf8')) as WorkbookPackage;
const parsed=parseFinanceWorkbook(input);
console.log('Workbook validated:',JSON.stringify(parsed.summary));
if(args.includes('--commit')){
  if(!args.includes('--database'))throw new Error('An explicit database path is required.');
  const path=resolve(arg('--database')),db=new DatabaseSync(path);
  try{
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const target=path+'.finance-backup-'+new Date().toISOString().replace(/[:.]/g,'-');
    await backup(db,target);console.log('Pre-import SQLite backup created.');
    console.log('Import:',JSON.stringify(importFinanceWorkbook(db,input)));
  }finally{db.close();}
}else console.log('Dry run only; no database was opened or changed.');
