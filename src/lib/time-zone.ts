const timeZoneHeaders = [
  "x-vercel-ip-timezone",
  "x-timezone",
  "x-geo-timezone",
  "cloudfront-viewer-time-zone",
];

function readHeader(headers: Headers, name: string) {
  return headers.get(name)?.trim() || null;
}

export function normalizeTimeZone(value: unknown) {
  if (typeof value !== "string") return null;

  const timeZone = value.trim();
  if (!timeZone || timeZone.length > 80) return null;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    return null;
  }
}

export function resolveRequestTimeZone(headers: Headers) {
  for (const header of timeZoneHeaders) {
    const timeZone = normalizeTimeZone(readHeader(headers, header));
    if (timeZone) return timeZone;
  }

  return null;
}

function formatOffset(timeZone: string) {
  try {
    const value = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;

    if (!value) return null;
    if (value === "GMT") return "UTC+00:00";

    const match = value.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return value.replace("GMT", "UTC");

    const [, sign, hours, minutes = "00"] = match;
    return `UTC${sign}${hours.padStart(2, "0")}:${minutes}`;
  } catch {
    return null;
  }
}

export function formatTimeZoneLabel(timeZone: string | null | undefined) {
  const normalized = normalizeTimeZone(timeZone);
  if (!normalized) return "Не определён";

  const offset = formatOffset(normalized);
  return offset ? `${normalized} (${offset})` : normalized;
}

export function formatTimeZoneLocalTime(timeZone: string | null | undefined) {
  const normalized = normalizeTimeZone(timeZone);
  if (!normalized) return null;

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: normalized,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}
