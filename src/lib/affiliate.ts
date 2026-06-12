export const SITE_BASE_URL = "https://efootball-nexon.com";

export function getRequestBaseUrl(request: Request) {
  const origin = request.headers.get("origin");

  if (origin && isPublicBaseUrl(origin)) {
    return origin;
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim();

  if (!host || host.includes("localhost") || host.includes("127.0.0.1")) {
    return SITE_BASE_URL;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "https";

  return `${protocol}://${host}`;
}

export function getConfiguredSiteBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  return configuredUrl && isPublicBaseUrl(configuredUrl) ? configuredUrl : SITE_BASE_URL;
}

function isPublicBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}
