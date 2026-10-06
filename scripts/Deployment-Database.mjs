// Installed read-only beside the broker. No caller paths, SQL or script arguments.
import {DatabaseSync,backup} from 'node:sqlite';
import {join} from 'node:path';
const root='D:\\!nas',mode=process.argv[2];
if(!['backup','worker'].includes(mode)||process.argv.length!==3)throw new Error('Invalid fixed operation');
const db=new DatabaseSync(join(root,'data/dashboard.sqlite'),{readOnly:true});
try{
  db.exec('PRAGMA busy_timeout=5000');
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Invalid database');
  if(mode==='backup'){
    const name='dashboard-delegated-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite',path=join(root,'data/backups',name);
    await backup(db,path);const saved=new DatabaseSync(path,{readOnly:true});try{if(saved.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||saved.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Invalid backup');}finally{saved.close();}
    console.log(name);
  }else console.log(db.prepare('SELECT heartbeat FROM pokemon_worker WHERE id=1').get()?.heartbeat||0);
}finally{db.close();}
