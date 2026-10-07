import {requireAdmin,authError} from '@/auth';
import {db} from '@/lib/db';
import {hostingEntry} from '@/lib/file-hosting/store';
import {hostingDownload} from '@/lib/file-hosting/download';
import {hostingFailure} from '@/lib/file-hosting/http';
import {HostingError} from '@/lib/file-hosting/types';

export const runtime='nodejs';
async function download(request:Request,context:{params:Promise<{id:string}>}) {
  try{await requireAdmin();}catch(error){return authError(error);}
  try{const file=hostingEntry(db(),(await context.params).id);if(file.kind!=='file'||file.state!=='ready')throw new HostingError('A fájl nem elérhető.',404);return await hostingDownload(db(),file,request);}
  catch(error){return hostingFailure(error);}
}
export {download as GET,download as HEAD};
