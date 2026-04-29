const PHONE_DIGITS_ONLY = /\D/g;

export function extractPhoneDigits(value: string) {
  return value.replace(PHONE_DIGITS_ONLY, "");
}

export function normalizePhoneNumber(value: string) {
  const digits = extractPhoneDigits(value.trim());

  if (!digits) return "";

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return "";
}

export function isValidPhoneNumber(value: string) {
  return Boolean(normalizePhoneNumber(value));
}

export function formatPhoneNumber(value?: string | null) {
  const normalized = normalizePhoneNumber(value ?? "");
  if (!normalized) {
    return value?.trim() ?? "";
  }

  if (/^\+7\d{10}$/.test(normalized)) {
    return `${normalized.slice(0, 2)} (${normalized.slice(2, 5)}) ${normalized.slice(5, 8)}-${normalized.slice(8, 10)}-${normalized.slice(10, 12)}`;
  }

  return normalized;
}

export function normalizeAuthIdentifier(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { type: "unknown" as const, value: "" };
  }

  if (trimmed.includes("@")) {
    return { type: "email" as const, value: trimmed.toLowerCase() };
  }

  const normalizedPhone = normalizePhoneNumber(trimmed);
  if (normalizedPhone) {
    return { type: "phone" as const, value: normalizedPhone };
  }

  return { type: "unknown" as const, value: trimmed };
}
