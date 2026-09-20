export const FAQ_IMAGE_MIME_TYPES = ["image/avif", "image/png", "image/jpeg", "image/webp"];
export const FAQ_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"];
export const FAQ_UPLOAD_MIME_TYPES = [...FAQ_IMAGE_MIME_TYPES, ...FAQ_VIDEO_MIME_TYPES, "application/pdf"];

/** Only web URLs and local absolute paths may be rendered as FAQ links or media. */
export function isSafeFaqUrl(value: string): boolean {
  const url = value.trim();
  if (!url || /[\u0000-\u0020\\]/.test(url)) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/** Build embeds from known providers; never accept arbitrary iframe URLs. */
export function getFaqVideoEmbedUrl(value: string): string | null {
  if (!isSafeFaqUrl(value)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (["youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
      const id = host === "youtu.be"
        ? url.pathname.split("/")[1]
        : url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
      return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "rutube.ru") {
      const id = url.pathname.match(/^\/(?:video|play\/embed)\/([a-f0-9]{32})(?:\/|$)/i)?.[1];
      return id ? `https://rutube.ru/play/embed/${id}` : null;
    }
  } catch {
    // Local uploaded videos use the native player.
  }
  return null;
}
