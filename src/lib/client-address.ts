export type ClientAddressHeaders = Headers | Record<string, unknown> | null | undefined;

function readHeader(headers: ClientAddressHeaders, name: string) {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return typeof value === "string" ? value : null;
}

export function getTrustedClientAddress(headers: ClientAddressHeaders) {
  return (
    readHeader(headers, "x-real-ip")?.trim() ||
    readHeader(headers, "x-forwarded-for")?.split(",").at(-1)?.trim() ||
    null
  );
}
