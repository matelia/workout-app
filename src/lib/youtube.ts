// Pure YouTube link helpers (no native imports, so they are easy to test).

/** Start offset in seconds from a YouTube link's t= / start= (e.g. "54", "54s", "1m22s"). */
export function youtubeStart(url: string): number {
  const m = url.match(/[?&#](?:t|start)=([\dhms]+)/i);
  if (!m) return 0;
  const v = m[1].toLowerCase();
  if (/^\d+s?$/.test(v)) return parseInt(v, 10);
  const part = (unit: string) => Number(v.match(new RegExp(`(\\d+)${unit}`))?.[1] ?? 0);
  return part('h') * 3600 + part('m') * 60 + part('s');
}

/** Returns the link with its start offset set (0 removes it). */
export function withYoutubeStart(url: string, seconds: number): string {
  const base = url.replace(/([?&])(?:t|start)=[\dhms]+&?/i, '$1').replace(/[?&]$/, '');
  if (!seconds) return base;
  return `${base}${base.includes('?') ? '&' : '?'}t=${Math.round(seconds)}`;
}

/** "1:22" <-> 82 */
export const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return 0;
  const m = t.match(/^(?:(\d+):)?(\d{1,2})$/);
  return m ? Number(m[1] ?? 0) * 60 + Number(m[2]) : null;
}
