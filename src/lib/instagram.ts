import { Directory, File, Paths } from 'expo-file-system';

import { parseEmbedCaption, parseOgCaption } from '@/lib/instagramParse';
import { instagramEmbedUrl } from '@/lib/video';

// Reads a public Instagram post/reel without logging in: the caption from the public embed
// page (the same page the Library uses to play Instagram videos), with the link-preview
// description as a fallback, plus the thumbnail image.

export type Reel = { url: string; caption: string; author: string | null; thumbnail: string | null };

export async function readReel(url: string): Promise<Reel> {
  const embed = instagramEmbedUrl(url);
  if (!embed) throw new Error('That doesn’t look like an Instagram post or reel link.');
  const canonical = embed.replace(/embed\/$/, '');
  let caption: string | null = null;
  let author: string | null = null;
  let image: string | null = null;

  try {
    const html = await (
      await fetch(`${embed}captioned/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' },
      })
    ).text();
    ({ caption, author, image } = parseEmbedCaption(html));
  } catch {
    // fall through to the link preview
  }
  if (!caption || !image) {
    try {
      const html = await (await fetch(canonical, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } })).text();
      const og = parseOgCaption(html);
      caption = caption ?? og.caption;
      image = image ?? og.image;
    } catch {
      // nothing else to try
    }
  }
  if (!caption && !image) throw new Error('Instagram didn’t share this post. It may be private. Try screenshots instead.');

  let thumbnail: string | null = null;
  if (image) {
    try {
      const dir = new Directory(Paths.document, 'screenshots');
      dir.create({ idempotent: true, intermediates: true });
      const file = await File.downloadFileAsync(image, new File(dir, `ig-${Date.now()}.jpg`));
      thumbnail = `screenshots/${file.name}`;
    } catch {
      thumbnail = null;
    }
  }
  return { url: canonical, caption: caption ?? '', author, thumbnail };
}
