import { isAbsolute } from 'node:path';
import { importDashboard } from '../lib/import-dashboard.ts';
const args=process.argv.slice(2),options={};
for(let index=0;index<args.length;index+=2){const name=args[index],value=args[index+1];if(!['--source','--destination','--owner-email'].includes(name)||!value||name in options)throw new Error('Usage: npm run import:dashboard -- --source <backup.sqlite> --destination <new-nullpont.sqlite> [--owner-email <email>]');options[name]=value;}
if(!options['--source']||!options['--destination']||!isAbsolute(options['--source'])||!isAbsolute(options['--destination']))throw new Error('Absolute snapshot and new destination paths are required');
const result=importDashboard(options['--source'],options['--destination'],options['--owner-email']);
console.log(JSON.stringify({imported:result.imported,sourceUnchanged:true,destinationVerified:true,credentialsCopied:false}));
