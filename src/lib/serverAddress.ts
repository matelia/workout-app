import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/repos/settings';

// The laptop address in Settings is either the server URL itself, or a link to a GitHub gist that the
// laptop keeps updated with its current Cloudflare tunnel address (which changes on every restart).
// For a gist, the last address found is cached, and looked up again when it stops answering.

const CACHE_KEY = 'server_resolved_url';
const RECHECK_MS = 5 * 60_000; // GitHub allows 60 unauthenticated lookups an hour; stay well under.
let lastRecheck = 0;

/** The gist ID in a gist.github.com / gist.githubusercontent.com link, or null for a plain server URL. */
export function gistId(address: string | null): string | null {
  if (!address) return null;
  const m = address.trim().match(/^https?:\/\/gist\.(?:github|githubusercontent)\.com\/(?:[^/]+\/)?([0-9a-f]{20,})/i);
  return m ? m[1].toLowerCase() : null;
}

/** Reads `{"url": "https://…"}` or a bare https URL from the gist file. */
export function parseAddress(text: string): string | null {
  let url: unknown = text.trim();
  try {
    url = (JSON.parse(text) as { url?: unknown }).url;
  } catch {
    // plain text
  }
  return typeof url === 'string' && /^https?:\/\/\S+$/.test(url.trim()) ? url.trim().replace(/\/+$/, '') : null;
}

async function lookUp(id: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/gists/${id}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const gist = (await res.json()) as { files?: Record<string, { content?: string }> };
  for (const f of Object.values(gist.files ?? {})) {
    const url = f.content ? parseAddress(f.content) : null;
    if (url) return url;
  }
  return null;
}

/**
 * The URL to call. `fresh` re-reads the gist (rate-limited), for when the cached address stopped answering.
 * Returns `changed` so callers know whether a retry is worth it.
 */
export async function resolveServerUrl(db: SQLiteDatabase, fresh = false): Promise<{ url: string | null; viaGist: boolean; changed: boolean }> {
  const address = await getSetting(db, 'snapshot_server_url');
  const id = gistId(address);
  if (!id) return { url: address, viaGist: false, changed: false };
  const cached = await getSetting(db, CACHE_KEY);
  if (cached && (!fresh || Date.now() - lastRecheck < RECHECK_MS)) return { url: cached, viaGist: true, changed: false };
  // Only re-checks count toward the limit, so the first lookup never delays following a restart.
  if (cached) lastRecheck = Date.now();
  try {
    const url = await lookUp(id);
    if (url && url !== cached) {
      await setSetting(db, CACHE_KEY, url);
      return { url, viaGist: true, changed: true };
    }
  } catch {
    // offline or GitHub unreachable: keep the cached address
  }
  return { url: cached, viaGist: true, changed: false };
}

/** Call when the address in Settings changes, so the next request looks it up again. */
export async function clearResolvedServerUrl(db: SQLiteDatabase) {
  lastRecheck = 0;
  await setSetting(db, CACHE_KEY, null);
}
