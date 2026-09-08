import { redis, redisKey } from "./redis";
import { redisNumber } from "./redis-config";

export const ENQUEUE_NOTIFICATION_SCRIPT = `
if redis.call('ZSCORE', KEYS[1], ARGV[1]) then return 1 end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('EXPIRE', KEYS[1], 604800)
return 1
`;

export const DRAIN_NOTIFICATION_SCRIPT = `
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2])
if #ids > 0 then redis.call('ZREM', KEYS[1], unpack(ids)) end
return ids
`;

type QueueOptions = {
  execute: (command: string[]) => Promise<unknown | null>;
  key: string;
  maxLength: number;
  now?: () => number;
};

export function createNotificationQueue(options: QueueOptions) {
  const now = options.now ?? Date.now;
  return {
    async enqueue(notificationId: string, availableAt = now()) {
      const result = await options.execute([
        "EVAL", ENQUEUE_NOTIFICATION_SCRIPT, "1", options.key,
        notificationId, String(availableAt), String(options.maxLength),
      ]);
      return result === 1;
    },
    async drain(limit: number): Promise<string[] | null> {
      if (!Number.isSafeInteger(limit) || limit < 1) return [];
      const result = await options.execute([
        "EVAL", DRAIN_NOTIFICATION_SCRIPT, "1", options.key, String(now()), String(Math.min(8, limit)),
      ]);
      if (!Array.isArray(result) || !result.every((entry): entry is string => typeof entry === "string")) return null;
      return result;
    },
  };
}

const queue = createNotificationQueue({
  execute: redis.execute,
  key: redisKey("notifications:delivery:v2"),
  maxLength: redisNumber(process.env.REDIS_NOTIFICATION_QUEUE_MAX_LENGTH, 5_000, 100_000),
});

export const enqueueNotificationDelivery = queue.enqueue;
export const drainNotificationDeliveryQueue = queue.drain;
