const TELEGRAM_HOSTS = new Set(["t.me", "www.t.me", "telegram.me", "www.telegram.me"]);

export function parseTelegramChatUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const candidate = /^(?:t\.me|telegram\.me)\//i.test(value) ? `https://${value}` : value;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Укажите корректную ссылку Telegram, например https://t.me/nexon_reviews.");
  }

  if (url.protocol !== "https:" || !TELEGRAM_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || url.pathname === "/") {
    throw new Error("Разрешены только публичные HTTPS-ссылки Telegram вида https://t.me/название.");
  }

  url.hash = "";
  return url.toString();
}
