import { getTrustedClientAddress } from "@/lib/client-address";

export const LEGAL_DOCUMENTS_VERSION = "2026-09-10";
export const TERMS_VERSION = LEGAL_DOCUMENTS_VERSION;
export const PERSONAL_DATA_CONSENT_VERSION = LEGAL_DOCUMENTS_VERSION;
export const PUBLIC_DATA_CONSENT_VERSION = LEGAL_DOCUMENTS_VERSION;
export const CROSS_BORDER_CONSENT_VERSION = LEGAL_DOCUMENTS_VERSION;

export const PUBLIC_DATA_CONSENT_CATEGORIES = [
  "PROFILE",
  "TOURNAMENT_ACTIVITY",
  "SOCIAL_LINKS",
  "PROFILE_TIME_DATA",
] as const;

export const LEGAL_ACCEPTANCE_REQUIRED_MESSAGE =
  "Необходимо отдельно принять пользовательское соглашение, согласие на обработку персональных данных, согласие на публикацию данных профиля и согласие на трансграничную передачу данных.";

type HeaderSource = Headers | Record<string, string | string[] | undefined> | undefined;

function readHeader(headers: HeaderSource, key: string) {
  if (!headers) return null;

  if (headers instanceof Headers) {
    return headers.get(key);
  }

  const value = headers[key] ?? headers[key.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function isLegalAccepted(value: unknown) {
  return value === true || value === "true" || value === "1" || value === "on";
}

export function hasSeparateRegistrationConsents(input: {
  termsAccepted?: unknown;
  personalDataConsent?: unknown;
  publicDataConsent?: unknown;
  crossBorderConsent?: unknown;
}) {
  return isLegalAccepted(input.termsAccepted) && isLegalAccepted(input.personalDataConsent) && isLegalAccepted(input.publicDataConsent) && isLegalAccepted(input.crossBorderConsent);
}

export function getLegalAcceptanceData(headers: HeaderSource) {
  const userAgent = readHeader(headers, "user-agent")?.trim();

  return {
    legalAcceptedAt: new Date(),
    legalAcceptedVersion: LEGAL_DOCUMENTS_VERSION,
    legalAcceptedIp: getTrustedClientAddress(headers),
    legalAcceptedUserAgent: userAgent || null,
  };
}

export function getRegistrationConsentData(
  headers: HeaderSource,
) {
  const acceptedAt = new Date();
  const userAgent = readHeader(headers, "user-agent")?.trim();
  const ip = getTrustedClientAddress(headers);

  return {
    termsAcceptedAt: acceptedAt,
    termsAcceptedVersion: TERMS_VERSION,
    personalDataConsentAt: acceptedAt,
    personalDataConsentVersion: PERSONAL_DATA_CONSENT_VERSION,
    personalDataConsentIp: ip,
    personalDataConsentUserAgent: userAgent || null,
    publicDataConsentAt: acceptedAt,
    publicDataConsentVersion: PUBLIC_DATA_CONSENT_VERSION,
    publicDataConsentIp: ip,
    publicDataConsentUserAgent: userAgent || null,
    publicDataConsentCategories: [...PUBLIC_DATA_CONSENT_CATEGORIES],
    crossBorderConsentAt: acceptedAt,
    crossBorderConsentVersion: CROSS_BORDER_CONSENT_VERSION,
    crossBorderConsentIp: ip,
    crossBorderConsentUserAgent: userAgent || null,
    ...getLegalAcceptanceData(headers),
  };
}
