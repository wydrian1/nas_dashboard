import type { DatabaseSync } from 'node:sqlite';

export type Role = 'admin' | 'pokemon-reader' | 'info-reader' | 'nullpont-player';
export type Feature = 'admin' | 'pokemon' | 'important-info' | 'apk' | 'mobile-self';
// The nullpont-player role has no NAS feature: its only destination is the external game handoff.
export const homeForRole=(role:Role|null)=>role==='info-reader' ? '/important-info' : role==='pokemon-reader' ? '/pokemon' : role==='nullpont-player' ? '/adventure' : '/';
export type User = {email:string;role:Role;active:number;created_at:number;updated_at:number};
export class AccessError extends Error {
  status:number;
  constructor(message='Nincs jogosultság.',status=403){super(message);this.status=status;}
}
export const ownerEmail=()=> (process.env.ALLOWED_EMAIL || 'wydrian@gmail.com').trim().toLowerCase();
export function normalizeEmail(value:unknown):string {
  if(typeof value!=='string' || value.length>254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value.trim()))throw new AccessError('Érvénytelen e-mail-cím.');
  return value.trim().toLowerCase();
}
export function roleFor(db:DatabaseSync,email:unknown):Role|null {
  if(typeof email!=='string')return null;
  const normalized=email.trim().toLowerCase();
  if(normalized===ownerEmail())return 'admin';
  const row=db.prepare('SELECT role FROM dashboard_users WHERE email=? AND active=1').get(normalized) as {role:Role}|undefined;
  return row && ['admin','pokemon-reader','info-reader','nullpont-player'].includes(row.role) ? row.role : null;
}
export function canAccess(role:Role|null,feature:Feature):boolean {
  return role==='admin' || (role==='pokemon-reader' && ['pokemon','apk','mobile-self'].includes(feature))
    || (role==='info-reader' && ['important-info','apk','mobile-self'].includes(feature));
}
export function requireAccess(db:DatabaseSync,email:unknown,feature:Feature):Role {
  const role=roleFor(db,email);
  if(!role)throw new AccessError('Bejelentkezés szükséges.',401);
  if(!canAccess(role,feature))throw new AccessError();
  return role;
}
export function initializeUsers(db:DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS dashboard_users (
    email TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('admin','pokemon-reader','info-reader','nullpont-player')),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pokemon_user_notifications (
    email TEXT NOT NULL REFERENCES dashboard_users(email),shop_id TEXT NOT NULL REFERENCES pokemon_shops(id),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
    notify_new INTEGER NOT NULL DEFAULT 1 CHECK(notify_new IN (0,1)),
    notify_restock INTEGER NOT NULL DEFAULT 1 CHECK(notify_restock IN (0,1)),
    notify_preorder INTEGER NOT NULL DEFAULT 1 CHECK(notify_preorder IN (0,1)),PRIMARY KEY(email,shop_id)
  );
  CREATE TABLE IF NOT EXISTS user_role_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,email TEXT NOT NULL,old_role TEXT,new_role TEXT,
    active INTEGER NOT NULL,occurred_at INTEGER NOT NULL
  );`);
  // Widen the existing CHECK without renaming its parent or losing child notification FKs.
  const schema=String(db.prepare("SELECT sql FROM sqlite_master WHERE name='dashboard_users'").get()!.sql);
  if(!schema.includes("'nullpont-player'")){
    const foreignKeys=Number(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys);
    db.exec('PRAGMA foreign_keys=OFF');
    try{db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE dashboard_users_expanded (
        email TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('admin','pokemon-reader','info-reader','nullpont-player')),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
      INSERT INTO dashboard_users_expanded SELECT email,role,active,created_at,updated_at FROM dashboard_users ORDER BY rowid;
      DROP TABLE dashboard_users;
      ALTER TABLE dashboard_users_expanded RENAME TO dashboard_users;`);
      if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('User-role migration foreign-key check failed');
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    finally{db.exec('PRAGMA foreign_keys='+foreignKeys);}
  }
  const owner=ownerEmail(),now=Date.now();
  db.prepare(`INSERT INTO dashboard_users(email,role,active,created_at,updated_at) VALUES(?,'admin',1,?,?)
    ON CONFLICT(email) DO UPDATE SET role='admin',active=1`).run(owner,now,now);
  // Preserve the owner's existing notification choices once; other accounts default independently.
  db.prepare(`INSERT OR IGNORE INTO pokemon_user_notifications(email,shop_id,notify_new,notify_restock,notify_preorder)
    SELECT ?,id,notify_new,notify_restock,notify_preorder FROM pokemon_shops`).run(owner);
}
export function setUserRole(db:DatabaseSync,actor:string,emailInput:unknown,roleInput:unknown,active:boolean,now=Date.now()) {
  requireAccess(db,actor,'admin');const email=normalizeEmail(emailInput);
  if(roleInput!=='admin' && roleInput!=='pokemon-reader' && roleInput!=='info-reader' && roleInput!=='nullpont-player')throw new AccessError('Érvénytelen szerepkör.');
  if(email===ownerEmail())throw new AccessError('A tulajdonos admin jogosultsága nem módosítható.');
  if(email===actor.toLowerCase() && (!active || roleInput!=='admin'))throw new AccessError('A saját admin hozzáférésed nem vonhatod vissza.');
  const before=db.prepare('SELECT role FROM dashboard_users WHERE email=?').get(email) as {role:Role}|undefined;
  if(!before && Number(db.prepare('SELECT count(*) AS n FROM dashboard_users').get()!.n)>=100)throw new AccessError('Legfeljebb 100 felhasználó adható hozzá.');
  db.exec('BEGIN IMMEDIATE');try{
    db.prepare(`INSERT INTO dashboard_users(email,role,active,created_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=excluded.active,updated_at=excluded.updated_at`).run(email,roleInput,Number(active),now,now);
    db.prepare('INSERT INTO user_role_audit(actor,email,old_role,new_role,active,occurred_at) VALUES(?,?,?,?,?,?)').run(actor.toLowerCase(),email,before?.role || null,roleInput,Number(active),now);
    if(!active){
      db.prepare('UPDATE mobile_devices SET revoked=1,push_enabled=0,fcm_token=NULL WHERE email=?').run(email);
      db.prepare("UPDATE mobile_push_outbox SET state='cancelled' WHERE state IN ('queued','retry') AND device_id IN (SELECT id FROM mobile_devices WHERE email=?)").run(email);
    }
    else if(roleInput==='info-reader' || roleInput==='nullpont-player'){
      // These module-less roles receive no pushes, including from a prior worker during rollout.
      db.prepare('UPDATE mobile_devices SET push_enabled=0,fcm_token=NULL WHERE email=?').run(email);
      db.prepare("UPDATE mobile_push_outbox SET state='cancelled' WHERE state IN ('queued','retry') AND device_id IN (SELECT id FROM mobile_devices WHERE email=?)").run(email);
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
