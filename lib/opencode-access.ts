import type { DatabaseSync } from 'node:sqlite';
import { decode,encode,type JWT } from 'next-auth/jwt';
import { AccessError,ownerEmail,roleFor } from './users.ts';
import { deviceAuthorized } from './mobile/store.ts';
import { createHash,randomBytes } from 'node:crypto';
import { DASHBOARD_ORIGIN,OPENCODE_COOKIE,OPENCODE_COOKIE_DOMAIN,OPENCODE_LEASE_SECONDS,accessCookieToken } from './opencode-policy.ts';
export { OPENCODE_ORIGIN,DASHBOARD_ORIGIN,OPENCODE_COOKIE,OPENCODE_COOKIE_DOMAIN,OPENCODE_LEASE_SECONDS,accessCookieToken } from './opencode-policy.ts';
export function isOpenCodeOwner(email:unknown):boolean {return typeof email==='string' && email.trim().toLowerCase()===ownerEmail();}
export function requireOpenCodeIdentity(database:DatabaseSync,identity:{email?:unknown;mobileDeviceId?:unknown}) {
  const role=roleFor(database,identity.email);
  if(!role)throw new AccessError('Bejelentkezés szükséges.',401);
  if(role!=='admin' || !isOpenCodeOwner(identity.email))throw new AccessError('Az OpenCode csak a tulajdonosnak érhető el.');
  const email=ownerEmail();
  if(identity.mobileDeviceId!==undefined && (typeof identity.mobileDeviceId!=='string' || !deviceAuthorized(database,identity.mobileDeviceId,email)))throw new AccessError('A telefon hozzáférése lejárt vagy visszavont.',401);
  return {email,mobileDeviceId:identity.mobileDeviceId as string|undefined};
}
export function checkOpenCodeLaunchOrigin(request:Request) {
  if(request.headers.get('origin')!==DASHBOARD_ORIGIN || request.headers.get('sec-fetch-site')==='cross-site')throw new AccessError('Nem engedélyezett eredet.');
}
export function openCodeCookie(token:string,maxAge=OPENCODE_LEASE_SECONDS):string {
  if(token && !/^[A-Za-z0-9_.-]+$/.test(token))throw new Error('Invalid OpenCode access cookie');
  return `${OPENCODE_COOKIE}=${token}; Domain=${OPENCODE_COOKIE_DOMAIN}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
}
const familyHash=(family:string)=>createHash('sha256').update(family).digest('hex');
export async function mintOpenCodeLease(database:DatabaseSync,parent:JWT,secret:string,previousHeader:string|null=null):Promise<string> {
  const identity=requireOpenCodeIdentity(database,parent),parentExpires=Number(parent.exp),now=Math.floor(Date.now()/1000);
  if(!Number.isSafeInteger(parentExpires) || parentExpires<=now)throw new AccessError('A dashboard-munkamenet lejárt.',401);
  const maxAge=Math.min(OPENCODE_LEASE_SECONDS,parentExpires-now);
  let family=randomBytes(32).toString('base64url');
  let renewed=false;
  try{const previous=await verifyOpenCodeLease(database,previousHeader,secret);if(previous.email===identity.email && previous.mobileDeviceId===identity.mobileDeviceId){family=previous.family;renewed=true;}}catch{}
  database.prepare('DELETE FROM opencode_access_families WHERE expires_at<=?').run(Date.now());
  if(!renewed && Number(database.prepare('SELECT count(*) AS n FROM opencode_access_families').get()!.n)>=100)throw new AccessError('Túl sok aktív OpenCode-munkamenet. Próbáld újra néhány perc múlva.',429);
  database.prepare(`INSERT INTO opencode_access_families(id_hash,email,device_id,expires_at) VALUES(?,?,?,?)
    ON CONFLICT(id_hash) DO UPDATE SET expires_at=excluded.expires_at`).run(familyHash(family),identity.email,identity.mobileDeviceId ?? null,Date.now()+maxAge*1000);
  const token=await encode({secret,salt:OPENCODE_COOKIE,maxAge,token:{...identity,family,purpose:'nas-opencode-access',parentExpires}});
  return openCodeCookie(token,maxAge);
}
export async function verifyOpenCodeLease(database:DatabaseSync,header:string|null,secret:string) {
  const raw=accessCookieToken(header);if(!raw)throw new AccessError('Nyisd meg az OpenCode oldalt a bejelentkezett dashboardból.',401);
  let token:JWT|null;try{token=await decode({secret,salt:OPENCODE_COOKIE,token:raw});}catch{throw new AccessError('Az OpenCode-hozzáférés lejárt.',401);}
  const now=Math.floor(Date.now()/1000);
  if(!token || token.purpose!=='nas-opencode-access' || typeof token.exp!=='number' || token.exp<=now || typeof token.parentExpires!=='number' || token.parentExpires<=now || token.exp>token.parentExpires || typeof token.iat!=='number' || token.exp-token.iat>OPENCODE_LEASE_SECONDS)throw new AccessError('Az OpenCode-hozzáférés lejárt.',401);
  if(typeof token.family!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(token.family))throw new AccessError('Érvénytelen OpenCode-munkamenet.',401);
  const identity=requireOpenCodeIdentity(database,token),family=database.prepare('SELECT email,device_id FROM opencode_access_families WHERE id_hash=? AND revoked=0 AND expires_at>?').get(familyHash(token.family),Date.now()) as {email:string;device_id:string|null}|undefined;
  if(!family || family.email!==identity.email || family.device_id!==(identity.mobileDeviceId ?? null))throw new AccessError('Az OpenCode-hozzáférés visszavont.',401);
  return {...identity,family:token.family};
}
export async function revokeOpenCodeFamily(database:DatabaseSync,header:string|null,secret:string) {
  const raw=accessCookieToken(header);if(!raw)return;
  try{const token=await decode({secret,salt:OPENCODE_COOKIE,token:raw});if(typeof token?.family==='string')database.prepare('UPDATE opencode_access_families SET revoked=1 WHERE id_hash=?').run(familyHash(token.family));}catch{}
}
