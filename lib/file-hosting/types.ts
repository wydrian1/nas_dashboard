export const MAX_FILE_BYTES=1_000_000_000;
export const UPLOAD_TIMEOUT_MS=60*60*1000;
export type HostedEntry={id:string;parent_id:string|null;name:string;kind:'file'|'folder';state:'uploading'|'ready';size:number;sha256:string|null;created_at:number};
export type HostedLink={id:string;file_id:string;expires_at:number|null;revoked_at:number|null;created_at:number};
export type HostingListing={folder:HostedEntry|null;breadcrumbs:HostedEntry[];entries:HostedEntry[];links:HostedLink[];maxFileBytes:number};
export class HostingError extends Error {
  status:number;
  constructor(message:string,status=400){super(message);this.status=status;}
}
export function hostingId(value:unknown):string {
  if(typeof value!=='string'||!/^[a-f0-9]{32}$/.test(value))throw new HostingError('Érvénytelen fájl- vagy mappaazonosító.');return value;
}
export function hostingName(value:unknown):string {
  if(typeof value!=='string')throw new HostingError('Hiányzó fájl- vagy mappanév.');
  const name=value.normalize('NFC');
  if(!name||!name.isWellFormed()||name.length>180||/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069<>:"/\\|?*]/.test(name)||/^[. ]|[. ]$/.test(name)||/^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/i.test(name))throw new HostingError('Érvénytelen név: ne használj elérési utat, speciális Windows-nevet vagy záró pontot/szóközt.');
  return name;
}
export function formatFileSize(bytes:number):string {
  return bytes>=1_000_000_000?(bytes/1_000_000_000).toFixed(2)+' GB':bytes>=1_000_000?(bytes/1_000_000).toFixed(1)+' MB':bytes>=1000?(bytes/1000).toFixed(1)+' kB':bytes+' B';
}
