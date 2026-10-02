import { requireUser } from '@/auth';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function GET() {
  try{await requireUser();}catch{return Response.json({error:'Bejelentkezés szükséges.'},{status:401,headers:{'Cache-Control':'no-store'}});}
  try{
    const apk=await readFile(join(process.cwd(),'.runtime','artifacts','Wydrian-NAS-1.0.0.apk'));
    return new Response(apk,{headers:{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="Wydrian-NAS-1.0.0.apk"','Content-Length':String(apk.length),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return Response.json({error:'Az APK még nem érhető el.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
