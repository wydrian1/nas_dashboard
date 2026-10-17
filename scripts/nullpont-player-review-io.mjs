import { writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Windows readers/antivirus may briefly hold the destination. Retry publishing
// the same response, never replaying the UI action that produced it.
export function writeReviewFile(path, value, rename = renameSync) {
  const temp = path + '.' + randomUUID() + '.tmp';
  writeFileSync(temp, JSON.stringify(value, null, 2), { flag: 'wx' });
  try {
    for (let attempt=0;;attempt++) {
      try { rename(temp, path); return; }
      catch (error) {
        if (attempt>=4 || !['EPERM','EACCES','EBUSY'].includes(error.code)) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);
      }
    }
  } finally { if (existsSync(temp)) unlinkSync(temp); }
}
