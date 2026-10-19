// Pure HTML parsing for Instagram embed and link-preview pages (no native imports, so it is testable).

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#064;/g, '@')
    .replace(/&#x2022;/g, '•')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .trim();

const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i'))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["']`, 'i'))?.[1] ??
  null;

/** Pure parsing, exported for tests. */
export function parseEmbedCaption(html: string): { caption: string | null; author: string | null; image: string | null } {
  const capBlock = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  let caption: string | null = null;
  let author: string | null = null;
  if (capBlock) {
    author = decode(capBlock.match(/class="CaptionUsername"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '') || null;
    caption = decode(capBlock.replace(/<a[^>]*class="CaptionUsername"[\s\S]*?<\/a>/i, '').replace(/<div class="CaptionComments"[\s\S]*$/i, ''));
  }
  const image = html.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/i)?.[1]?.replace(/&amp;/g, '&') ?? null;
  return { caption: caption || null, author, image };
}

/** og:description looks like: 123 likes, 4 comments - user on Date: "caption…". */
export function parseOgCaption(html: string): { caption: string | null; image: string | null } {
  const desc = meta(html, 'og:description') ?? meta(html, 'og:title');
  const quoted = desc ? decode(desc).match(/:\s*"([\s\S]*)"\s*\.?$/)?.[1] : null;
  return { caption: quoted ?? (desc ? decode(desc) : null), image: meta(html, 'og:image')?.replace(/&amp;/g, '&') ?? null };
}
