export const homeLinks = {
  telegram: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon",
  vk: process.env.NEXT_PUBLIC_SUPPORT_VK_URL ?? "https://vk.com/efootball_nexon",
  market: "https://t.me/eFootballNexonMarketBot",
};

export function getAndroidDownloadUrl() {
  const configured = process.env.ANDROID_APK_URL?.trim() || "/downloads/efootball-nexon.apk";
  if (!configured) return null;
  if (configured.startsWith("/") && !configured.startsWith("//") && !configured.includes("\\")) return configured;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
