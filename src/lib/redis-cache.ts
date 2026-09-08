import { redis } from "./redis";

const DEFAULT_TTL_SECONDS = 60;

export async function getRedisJson<T>(key: string): Promise<T | null> {
  const result = await redis.execute(["GET", key]);
  if (typeof result !== "string") return null;
  try {
    return JSON.parse(result) as T;
  } catch {
    return null;
  }
}

export async function setRedisJson<T>(key: string, value: T, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return false;
  const result = await redis.execute(["SET", key, serialized, "EX", String(Math.max(1, ttlSeconds))]);
  return result === "OK";
}

export async function deleteRedisKey(key: string) {
  await redis.execute(["DEL", key]);
}

export async function deleteRedisKeysByPattern(pattern: string) {
  let cursor = "0";
  do {
    const result = await redis.execute(["SCAN", cursor, "MATCH", pattern, "COUNT", "100"]);
    if (!Array.isArray(result) || result.length !== 2) return;
    const nextCursor = result[0];
    const keys = result[1];
    if (typeof nextCursor !== "string" || !Array.isArray(keys)) return;
    cursor = nextCursor;
    const validKeys = keys.filter((key): key is string => typeof key === "string");
    if (validKeys.length) await redis.execute(["DEL", ...validKeys]);
  } while (cursor !== "0");
}

export async function getOrSetRedisJson<T>(key: string, loader: () => Promise<T>, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const cached = await getRedisJson<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  await setRedisJson(key, value, ttlSeconds);
  return value;
}
