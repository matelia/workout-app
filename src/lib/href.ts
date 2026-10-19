/** Builds a route string with query params, skipping null/undefined values. */
export function href(path: string, params: Record<string, string | number | null | undefined> = {}): never {
  const q = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return (q ? `${path}?${q}` : path) as never;
}