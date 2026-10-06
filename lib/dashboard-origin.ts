export const DASHBOARD_ORIGINS=['https://nas.wydrian.hu','https://wydrian.hu'] as const;
export type DashboardOrigin=typeof DASHBOARD_ORIGINS[number];
export function dashboardOrigin(value:unknown):DashboardOrigin {
  if(typeof value!=='string'||!DASHBOARD_ORIGINS.some(origin=>origin===value))throw new Error('Unsupported dashboard origin');
  return value as DashboardOrigin;
}
// Caddy sets these headers; the Next server is loopback-only. Reject lists, ports, suffixes and non-HTTPS.
export function dashboardRequestOrigin(headers:Pick<Headers,'get'>):DashboardOrigin {
  const host=headers.get('x-forwarded-host')||headers.get('host');
  if(headers.get('x-forwarded-proto')!=='https')throw new Error('HTTPS dashboard origin required');
  return dashboardOrigin('https://'+host);
}
export function dashboardSameOrigin(request:Request):boolean {
  if(request.headers.get('sec-fetch-site')==='cross-site')return false;
  try{
    const expected=request.headers.has('x-forwarded-host')?dashboardRequestOrigin(request.headers):dashboardOrigin(new URL(request.url).origin);
    return dashboardOrigin(request.headers.get('origin'))===expected;
  }catch{return false;}
}
