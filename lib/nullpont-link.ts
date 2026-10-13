// Optional external shortcut only; the dashboard never opens the game's database.
export function nullpontUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || ['nas.wydrian.hu', 'wydrian.hu', 'localhost'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
