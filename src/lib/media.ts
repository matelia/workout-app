import { Directory, File, Paths } from 'expo-file-system';

// Photos and recordings are copied into the app's documents folder and stored as *relative*
// paths, because the absolute container path on iOS changes between app updates.

export function storeMedia(sourceUri: string, folder: string, ext: string): string {
  const dir = new Directory(Paths.document, folder);
  dir.create({ idempotent: true, intermediates: true });
  const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  new File(sourceUri).copy(new File(dir, name));
  return `${folder}/${name}`;
}

export function mediaUri(relative: string): string {
  return new File(Paths.document, relative).uri;
}

export function deleteMedia(relative: string | null | undefined) {
  if (!relative) return;
  const f = new File(Paths.document, relative);
  if (f.exists) f.delete();
}

export function extOf(uri: string, fallback: string) {
  const m = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : fallback;
}
