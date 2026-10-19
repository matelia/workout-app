import { Directory, File, Paths } from 'expo-file-system';

// Photos and recordings are copied into the app's documents folder and stored as *relative*
// paths, because the absolute container path on iOS changes between app updates.

export function storeMedia(sourceUri: string, folder: string, ext: string): string {
  const dir = new Directory(Paths.document, folder);
  dir.create({ idempotent: true, intermediates: true });
  const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`;
  new File(sourceUri).copySync(new File(dir, name));
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

/** Pick up to `limit` screenshots/photos from the library and copy them into the app. */
export async function pickScreenshots(folder: string, limit = 8): Promise<string[]> {
  const ImagePicker = await import('expo-image-picker');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 0.8,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => storeMedia(a.uri, folder, 'jpg'));
}
