import { cookies } from "next/headers";

export const AFFILIATE_REF_COOKIE = "efn_affiliate_ref";

export function normalizePromoCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeReferralSlug(value: string) {
  const raw = value.trim();

  try {
    const url = new URL(raw);
    const ref = url.searchParams.get("ref");
    if (ref) return normalizeSlug(ref);

    const pathParts = url.pathname.split("/").filter(Boolean);
    return normalizeSlug(pathParts[pathParts.length - 1] ?? raw);
  } catch {
    return normalizeSlug(raw.replace(/^\/?ref\//i, "").replace(/^\/?coins\?ref=/i, ""));
  }
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getAffiliateRefCookie() {
  return cookies().get(AFFILIATE_REF_COOKIE)?.value ?? null;
}

export function formatReferralLink(baseUrl: string, slug: string) {
  return `${baseUrl.replace(/\/$/, "")}/ref/${encodeURIComponent(slug)}`;
}

export function getRequestBaseUrl(request: Request) {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin;
  }

  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim();

  if (!host) {
    return requestUrl.origin;
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "") || "https";

  return `${protocol}://${host}`;
}
