export const LEGAL_DOCUMENTS_VERSION = "2026-04-18";

export const LEGAL_ACCEPTANCE_REQUIRED_MESSAGE =
  "Необходимо принять пользовательское соглашение, политику конфиденциальности и согласие на обработку персональных данных.";

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

export function getLegalAcceptanceData(headers: HeaderSource) {
  const forwardedFor = readHeader(headers, "x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = readHeader(headers, "x-real-ip")?.trim();
  const userAgent = readHeader(headers, "user-agent")?.trim();

  return {
    legalAcceptedAt: new Date(),
    legalAcceptedVersion: LEGAL_DOCUMENTS_VERSION,
    legalAcceptedIp: forwardedFor || realIp || null,
    legalAcceptedUserAgent: userAgent || null,
  };
}
