import { Directory, File, Paths } from 'expo-file-system';

import type { VideoType } from '@/db/repos/exercises';

export function youtubeId(url: string): string | null {
  const m = url
    .trim()
    .match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function instagramEmbedUrl(url: string): string | null {
  const m = url.trim().match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
  if (!m) return null;
  const kind = m[1] === 'reels' ? 'reel' : m[1];
  return `https://www.instagram.com/${kind}/${m[2]}/embed/`;
}

/** Returns an error message, or null if the link is usable for that video type. */
export function validateVideo(type: VideoType, value: string): string | null {
  if (!value.trim()) return 'Add a link or pick a file.';
  if (type === 'youtube' && !youtubeId(value)) return "That doesn't look like a YouTube link.";
  if (type === 'instagram' && !instagramEmbedUrl(value))
    return 'Use a public Instagram post or reel link (instagram.com/p/… or /reel/…).';
  return null;
}

// Local videos are copied into the app's documents folder and stored as a *relative* path,
// because the absolute container path on iOS changes between app updates.
const VIDEO_DIR = 'videos';

export function copyVideoIntoApp(sourceUri: string, originalName: string): string {
  const dir = new Directory(Paths.document, VIDEO_DIR);
  dir.create({ idempotent: true, intermediates: true });
  const safeName = `${Date.now()}-${originalName.replace(/[^\w.-]/g, '_')}`;
  new File(sourceUri).copySync(new File(dir, safeName));
  return `${VIDEO_DIR}/${safeName}`;
}

export function localVideoUri(relativePath: string): string {
  return new File(Paths.document, relativePath).uri;
}

export function deleteLocalVideo(relativePath: string) {
  const f = new File(Paths.document, relativePath);
  if (f.exists) f.delete();
}
