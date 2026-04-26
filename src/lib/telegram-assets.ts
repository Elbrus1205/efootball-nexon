const telegramAssetHosts = [
  "t.me",
  "telegram.org",
  "oauth.telegram.org",
  "telesco.pe",
  "telegram-cdn.org",
  "telegram-cdn.com",
];

export function isTelegramAssetUrl(src?: string | null) {
  if (!src) return false;

  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();

    return telegramAssetHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function proxyTelegramAssetUrl(src?: string | null) {
  if (src?.startsWith("telegram-file:")) {
    return `/api/telegram/image?fileId=${encodeURIComponent(src.slice("telegram-file:".length))}`;
  }

  if (!src || !isTelegramAssetUrl(src)) return src ?? undefined;

  return `/api/telegram/image?url=${encodeURIComponent(src)}`;
}
