import {db} from '@/lib/db';
import {resolveHostingLink} from '@/lib/file-hosting/store';
import {hostingDownload} from '@/lib/file-hosting/download';
import {hostingFailure} from '@/lib/file-hosting/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';
async function download(request:Request,context:{params:Promise<{token:string}>}) {
  try{const file=resolveHostingLink(db(),(await context.params).token,process.env.AUTH_SECRET||'');return await hostingDownload(db(),file,request);}
  catch(error){return hostingFailure(error,true);}
}
export {download as GET,download as HEAD};
