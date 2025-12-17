/**
 * Social link previews for YouTube/TikTok/Instagram.
 * - Uses oEmbed when available (YouTube/TikTok) for title/author/thumbnail.
 * - Instagram oEmbed is often restricted; we gracefully fall back to a generic card.
 *
 * IMPORTANT: This is best-effort. It must never throw during rendering.
 */

export type SocialProvider = 'youtube' | 'tiktok' | 'instagram';

export type SocialPreview = {
  provider: SocialProvider;
  url: string;            // canonical-ish url (normalized protocol)
  title?: string;
  authorName?: string;
  thumbnailUrl?: string;
};

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;

const splitTrailingPunctuation = (raw: string): string => {
  const match = raw.match(/^(.+?)([),.!?;:]+)$/);
  return match ? match[1] : raw;
};

const normalizeUrl = (rawUrl: string): string => {
  if (rawUrl.startsWith('www.')) return `https://${rawUrl}`;
  if (!rawUrl.match(/^https?:\/\//i)) return `https://${rawUrl}`;
  return rawUrl;
};

const tryParseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

const getYouTubeId = (u: URL): string | null => {
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id || null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    // watch?v=
    const v = u.searchParams.get('v');
    if (v) return v;
    // shorts/<id>
    const parts = u.pathname.split('/').filter(Boolean);
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    // embed/<id>
    const embedIdx = parts.indexOf('embed');
    if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  }
  return null;
};

const classifySocialUrl = (url: string): { provider: SocialProvider; canonicalUrl: string; youtubeId?: string } | null => {
  const u = tryParseUrl(url);
  if (!u) return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  // YouTube
  if (host === 'youtu.be' || host.endsWith('youtube.com')) {
    const id = getYouTubeId(u);
    const canonical = id ? `https://www.youtube.com/watch?v=${id}` : `https://${u.hostname}${u.pathname}${u.search}`;
    return { provider: 'youtube', canonicalUrl: canonical, youtubeId: id || undefined };
  }

  // TikTok
  if (host.endsWith('tiktok.com')) {
    return { provider: 'tiktok', canonicalUrl: url };
  }

  // Instagram
  if (host.endsWith('instagram.com')) {
    return { provider: 'instagram', canonicalUrl: url };
  }

  return null;
};

export function extractSocialLinks(text: string): SocialPreview[] {
  const found: SocialPreview[] = [];
  if (!text) return found;

  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const candidate = normalizeUrl(splitTrailingPunctuation(match[0]));
    const classified = classifySocialUrl(candidate);
    if (!classified) continue;

    const base: SocialPreview = { provider: classified.provider, url: classified.canonicalUrl };
    if (classified.provider === 'youtube' && classified.youtubeId) {
      // Stable thumbnail without any API calls
      base.thumbnailUrl = `https://img.youtube.com/vi/${classified.youtubeId}/hqdefault.jpg`;
    }
    found.push(base);
  }

  // Dedup by provider+url, preserve order
  const seen = new Set<string>();
  return found.filter((p) => {
    const k = `${p.provider}:${p.url}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Cache to avoid refetching while scrolling feed
const previewCache = new Map<string, SocialPreview>();

const withTimeout = async <T,>(p: Promise<T>, ms: number): Promise<T> => {
  let timeout: any;
  const t = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('timeout')), ms);
  });
  try {
    return await Promise.race([p, t]) as T;
  } finally {
    clearTimeout(timeout);
  }
};

export async function fetchSocialPreview(base: SocialPreview): Promise<SocialPreview> {
  const cacheKey = `${base.provider}:${base.url}`;
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  try {
    if (base.provider === 'youtube') {
      // YouTube oEmbed (no auth)
      const resp = await withTimeout(fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(base.url)}`), 4000);
      if (resp.ok) {
        const json: any = await resp.json();
        const full: SocialPreview = {
          ...base,
          title: json?.title || base.title,
          authorName: json?.author_name || base.authorName,
          thumbnailUrl: json?.thumbnail_url || base.thumbnailUrl,
        };
        previewCache.set(cacheKey, full);
        return full;
      }
    }

    if (base.provider === 'tiktok') {
      // TikTok oEmbed (best-effort; may be rate limited)
      const resp = await withTimeout(fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(base.url)}`), 4000);
      if (resp.ok) {
        const json: any = await resp.json();
        const full: SocialPreview = {
          ...base,
          title: json?.title || base.title,
          authorName: json?.author_name || base.authorName,
          thumbnailUrl: json?.thumbnail_url || base.thumbnailUrl,
        };
        previewCache.set(cacheKey, full);
        return full;
      }
    }

    if (base.provider === 'instagram') {
      // Instagram oEmbed often requires tokens; try and fall back quietly.
      const resp = await withTimeout(fetch(`https://api.instagram.com/oembed?url=${encodeURIComponent(base.url)}`), 4000);
      if (resp.ok) {
        const json: any = await resp.json();
        const full: SocialPreview = {
          ...base,
          title: json?.title || base.title,
          authorName: json?.author_name || base.authorName,
          thumbnailUrl: json?.thumbnail_url || base.thumbnailUrl,
        };
        previewCache.set(cacheKey, full);
        return full;
      }
    }
  } catch {
    // ignore
  }

  // Fallback: cached base so it’s stable
  previewCache.set(cacheKey, base);
  return base;
}


