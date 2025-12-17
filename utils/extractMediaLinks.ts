/**
 * Extract direct media URLs from a blob of text.
 * We only auto-embed "direct" links (file extensions) to keep this predictable.
 */

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

export type ExtractedMediaLinks = {
  imageUrls: string[];
  videoUrls: string[];
};

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url);

const isVideoUrl = (url: string) =>
  /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(url);

export function extractMediaLinks(text: string): ExtractedMediaLinks {
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];

  if (!text) return { imageUrls, videoUrls };

  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const candidate = normalizeUrl(splitTrailingPunctuation(match[0]));
    if (isVideoUrl(candidate)) videoUrls.push(candidate);
    else if (isImageUrl(candidate)) imageUrls.push(candidate);
  }

  // Dedup, preserve order
  const dedup = <T,>(arr: T[]) => Array.from(new Set(arr));
  return { imageUrls: dedup(imageUrls), videoUrls: dedup(videoUrls) };
}


