import type {DatabaseSync} from 'node:sqlite';
import {deploymentResult} from './protocol.ts';
import {queueReleaseAnnouncement} from '../mobile/task-reminders.ts';

// Only an authenticated terminal success for the exact prepared job may announce a release.
export function announceDeployment(db:DatabaseSync,text:string,key:string,prepared:{id:string;commit:string},version:string,now=Date.now()){
  const result=deploymentResult(text,key);
  if(result.id!==prepared.id||result.commit!==prepared.commit)throw new Error('Release announcement identity mismatch');
  if(result.state!=='succeeded'||result.phase!=='complete'||result.errorCode!==0)return 0;
  return queueReleaseAnnouncement(db,result.id,result.commit,version,now);
}
