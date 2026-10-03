export const OPENCODE_ORIGIN='https://opencode.nas.wydrian.hu';
export const DASHBOARD_ORIGIN='https://nas.wydrian.hu';
export const OPENCODE_COOKIE='__Secure-nas-opencode-access';
export const OPENCODE_LEASE_SECONDS=300;
export const OPENCODE_COOKIE_DOMAIN='nas.wydrian.hu';
export function accessCookieToken(header:string|null):string|null {
  const cookies=(header || '').split(';').map(item=>item.trim()).filter(item=>item.startsWith(OPENCODE_COOKIE+'='));
  if(cookies.length!==1)return null;
  const token=cookies[0].slice(OPENCODE_COOKIE.length+1);
  return token.length<=4096 && /^[A-Za-z0-9_.-]+$/.test(token) ? token : null;
}
