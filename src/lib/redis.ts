import { createClient } from "redis";
import { redisNumber } from "./redis-config";

export type RedisConnection = {
  isReady: boolean;
  isOpen: boolean;
  connect(): Promise<unknown>;
  destroy(): void;
  on(event: "error", listener: () => void): unknown;
  sendCommand(command: string[]): Promise<unknown>;
};

type RedisOptions = {
  url?: string;
  timeoutMs?: number;
  cooldownMs?: number;
  createConnection?: (url: string) => RedisConnection;
  now?: () => number;
  warn?: () => void;
};

export function createRedisGateway(options: RedisOptions) {
  const timeoutMs = options.timeoutMs ?? 500;
  const cooldownMs = options.cooldownMs ?? 30_000;
  const now = options.now ?? Date.now;
  const warn = options.warn ?? (() => console.warn("[redis] unavailable; fallback=postgresql"));
  let connection: RedisConnection | undefined;
  let connecting: Promise<void> | undefined;
  let disabledUntil = 0;

  function disconnect() {
    const previous = connection;
    connection = undefined;
    connecting = undefined;
    if (previous?.isOpen) previous.destroy();
  }

  function fail() {
    if (disabledUntil <= now()) warn();
    disabledUntil = now() + cooldownMs;
    disconnect();
  }

  async function execute(command: string[]): Promise<unknown | null> {
    if (!options.url || now() < disabledUntil) return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!connection) {
        const parsed = new URL(options.url);
        if (!["redis:", "rediss:"].includes(parsed.protocol)) throw new Error("Invalid Redis protocol");
        const current = options.createConnection?.(options.url) ?? createClient({
          url: options.url,
          disableOfflineQueue: true,
          commandsQueueMaxLength: 256,
          socket: { connectTimeout: timeoutMs, reconnectStrategy: false },
        });
        connection = current;
        current.on("error", () => {
          if (connection === current) fail();
        });
        connecting = current.connect().then(() => undefined);
      }
      const current = connection;
      const pending = connecting;
      return await Promise.race([
        (async () => {
          await pending;
          if (current !== connection || !current.isReady) throw new Error("Redis disconnected");
          return current.sendCommand(command);
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Redis deadline exceeded")), timeoutMs);
        }),
      ]);
    } catch {
      fail();
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { execute, disconnect };
}

export const redis = createRedisGateway({
  url: process.env.REDIS_URL?.trim(),
  timeoutMs: redisNumber(process.env.REDIS_TIMEOUT_MS, 500, 5_000),
});

export function redisKey(suffix: string) {
  const prefix = process.env.REDIS_KEY_PREFIX?.trim() || "efootball:production";
  return `${prefix}:${suffix}`;
}
