import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getTrustedClientAddress } from "@/lib/client-address";
import { MemoryRateLimiter, type RateLimitPolicy } from "@/lib/rate-limit";

declare global {
  // eslint-disable-next-line no-var
  var requestRateLimiter: MemoryRateLimiter | undefined;
}

type RequestWithHeaders = { headers?: Headers | Record<string, unknown> };

const limiter = global.requestRateLimiter ?? new MemoryRateLimiter();
if (process.env.NODE_ENV !== "production") global.requestRateLimiter = limiter;

function digestKey(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

export function consumeRequestRateLimit(
  request: RequestWithHeaders,
  scope: string,
  policy: RateLimitPolicy,
  identity?: string | null,
) {
  const client = getTrustedClientAddress(request.headers) ?? "unknown";
  const key = `${scope}:${digestKey(`${client}:${identity?.trim().toLowerCase() ?? ""}`)}`;
  return limiter.consume(key, policy);
}

export function enforceRateLimit(
  request: RequestWithHeaders,
  scope: string,
  policy: RateLimitPolicy,
  identity?: string | null,
) {
  const result = consumeRequestRateLimit(request, scope, policy, identity);
  if (result.allowed) return null;

  return NextResponse.json(
    { error: "Слишком много запросов. Попробуйте позже." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
