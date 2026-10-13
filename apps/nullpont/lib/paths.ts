export function basePath() {
  const value = process.env.NULLPONT_BASE_PATH || '';
  if (value !== '' && value !== '/nullpont') throw new Error('Unsupported game base path');
  return value;
}
export function gamePath(path: string) { return basePath() + path; }
export function applicationUrl(path: string, application: string) { return application.replace(/\/$/, '') + path; }
