import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const DEPLOYMENT_ID=/^[a-f0-9]{32}$/;
export const SHA256=/^[a-f0-9]{64}$/;
export const digest=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
export function deploymentSignature(id:string,time:string,hash:string,key:string){
  if(!DEPLOYMENT_ID.test(id)||!/^\d{13}$/.test(time)||!SHA256.test(hash)||Buffer.from(key,'base64').length!==32)throw new Error('Invalid deployment request');
  return createHmac('sha256',Buffer.from(key,'base64')).update(`deploy\n${id}\n${time}\n${hash}`).digest('hex');
}
export function deploymentResult(text:string,key:string){
  const envelope=JSON.parse(text);if(typeof envelope.payload!=='string'||!SHA256.test(envelope.signature))throw new Error('Invalid deployment result');
  const expected=createHmac('sha256',Buffer.from(key,'base64')).update('result\n'+envelope.payload).digest();
  if(!timingSafeEqual(expected,Buffer.from(envelope.signature,'hex')))throw new Error('Unauthenticated deployment result');
  return JSON.parse(envelope.payload) as {id:string;commit:string;state:string;phase:string;errorCode:number;at:number;failurePhase?:string;failureKind?:string;rollbackErrors?:Array<{step:string;errorCode:number}>};
}
export function deploymentPath(path:string):boolean {
  if(path.length>240||! /^[A-Za-z0-9_@()+.,/\[\]-]+$/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'||/[. ]$/.test(part)||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)))return false;
  if(path.split('/').some(part=>/^\.env(?:\.|$)/i.test(part))||/\.(?:sqlite(?:[-.].*)?|jks|keystore|pem|key|p12|pfx|nasbackup(?:\..*)?)$/i.test(path))return false;
  return path.startsWith('web/')||/^worker\/(?:lib\/(?:pokemon\/|mobile\/|finance\/).+\.ts|lib\/(?:db-schema|opencode-schema|users|url-policy|feed-download|sql-rows)\.ts|scripts\/Pokemon-Worker\.ts)$/.test(path)||path==='apk/release.apk';
}
