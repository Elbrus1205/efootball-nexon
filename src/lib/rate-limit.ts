export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const MAX_BUCKETS = 10_000;

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitResult {
    if (!Number.isSafeInteger(policy.limit) || policy.limit < 1 || policy.windowMs < 1) {
      throw new Error("Invalid rate limit policy");
    }

    const current = this.buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + policy.windowMs }
      : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (this.buckets.size > MAX_BUCKETS) {
      this.prune(now);
    }

    return {
      allowed: bucket.count <= policy.limit,
      remaining: Math.max(0, policy.limit - bucket.count),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now || this.buckets.size > MAX_BUCKETS) {
        this.buckets.delete(key);
      }
      if (this.buckets.size <= MAX_BUCKETS) break;
    }
  }
}
