import { getTrustedClientAddress } from "@/lib/client-address";

export const LEGAL_DOCUMENTS_VERSION = "2026-07-11";
export const TERMS_VERSION = LEGAL_DOCUMENTS_VERSION;
export const PERSONAL_DATA_CONSENT_VERSION = LEGAL_DOCUMENTS_VERSION;
export const PUBLIC_DATA_CONSENT_VERSION = LEGAL_DOCUMENTS_VERSION;
export const GUARDIAN_CONSENT_VERSION = LEGAL_DOCUMENTS_VERSION;
export const MINIMUM_REGISTRATION_AGE = 12;
export const ADULT_AGE = 18;

export const PUBLIC_DATA_CONSENT_CATEGORIES = [
  "PROFILE",
  "TOURNAMENT_ACTIVITY",
  "SOCIAL_LINKS",
  "PROFILE_TIME_DATA",
] as const;

export const LEGAL_ACCEPTANCE_REQUIRED_MESSAGE =
  "Необходимо отдельно принять пользовательское соглашение, согласие на обработку персональных данных и согласие на публикацию данных профиля.";

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

export function parseDateOfBirth(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (date.getTime() > Date.now()) return null;
  return date;
}

export function getAge(dateOfBirth: Date, now = new Date()) {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

export function getRegistrationAge(value: unknown) {
  const dateOfBirth = parseDateOfBirth(value);
  if (!dateOfBirth) return null;
  return { dateOfBirth, age: getAge(dateOfBirth) };
}

export function hasSeparateRegistrationConsents(input: {
  termsAccepted?: unknown;
  personalDataConsent?: unknown;
  publicDataConsent?: unknown;
}) {
  return isLegalAccepted(input.termsAccepted) && isLegalAccepted(input.personalDataConsent) && isLegalAccepted(input.publicDataConsent);
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
  input: {
    dateOfBirth: Date;
  },
) {
  const acceptedAt = new Date();
  const userAgent = readHeader(headers, "user-agent")?.trim();
  const ip = getTrustedClientAddress(headers);
  const isMinor = getAge(input.dateOfBirth, acceptedAt) < ADULT_AGE;

  return {
    dateOfBirth: input.dateOfBirth,
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
    guardianFullName: null,
    guardianEmail: null,
    guardianConsentAt: isMinor ? acceptedAt : null,
    guardianConsentVersion: isMinor ? GUARDIAN_CONSENT_VERSION : null,
    guardianConsentIp: isMinor ? ip : null,
    guardianConsentUserAgent: isMinor ? userAgent || null : null,
    ...getLegalAcceptanceData(headers),
  };
}
