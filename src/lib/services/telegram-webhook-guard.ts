import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const UPDATE_RETENTION_DAYS = 7;
const AI_RATE_LIMIT_PER_MINUTE = 5;

type ProcessedUpdateRepository = {
  createProcessedUpdate: (updateId: number, expiresAt: Date) => Promise<void>;
  deleteExpiredProcessedUpdates: (now: Date) => Promise<unknown>;
};

type RateLimitRepository = {
  incrementRateBucket: (scopeKey: string, windowStartedAt: Date) => Promise<number>;
};

const defaultProcessedUpdateRepository: ProcessedUpdateRepository = {
  createProcessedUpdate: async (updateId, expiresAt) => {
    await db.telegramProcessedUpdate.create({ data: { updateId: BigInt(updateId), expiresAt } });
  },
  deleteExpiredProcessedUpdates: async (now) => db.telegramProcessedUpdate.deleteMany({ where: { expiresAt: { lt: now } } }),
};

const defaultRateLimitRepository: RateLimitRepository = {
  incrementRateBucket: async (scopeKey, windowStartedAt) => {
    const bucket = await db.telegramAiRateBucket.upsert({
      where: { scopeKey_windowStartedAt: { scopeKey, windowStartedAt } },
      create: { scopeKey, windowStartedAt, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    return bucket.count;
  },
};

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code === "P2002"
    : typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function claimTelegramUpdate(
  updateId: number,
  repository: ProcessedUpdateRepository = defaultProcessedUpdateRepository,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + UPDATE_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
  try {
    await repository.createProcessedUpdate(updateId, expiresAt);
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
  if (Math.random() < 0.01) void repository.deleteExpiredProcessedUpdates(now).catch(() => undefined);
  return true;
}

export async function consumeTelegramAiRateLimit(params: {
  userId: string;
  chatId: string;
  now?: Date;
  repository?: RateLimitRepository;
}) {
  const now = params.now ?? new Date();
  const windowStartedAt = new Date(now);
  windowStartedAt.setUTCSeconds(0, 0);
  const scopeKey = `${params.userId}:${params.chatId}`;
  const repository = params.repository ?? defaultRateLimitRepository;
  const count = await repository.incrementRateBucket(scopeKey, windowStartedAt);
  if (repository === defaultRateLimitRepository && Math.random() < 0.01) {
    const cutoff = new Date(windowStartedAt.getTime() - 24 * 60 * 60 * 1_000);
    void db.telegramAiRateBucket.deleteMany({ where: { windowStartedAt: { lt: cutoff } } }).catch(() => undefined);
  }
  return {
    allowed: count <= AI_RATE_LIMIT_PER_MINUTE,
    retryAfterSeconds: Math.max(1, 60 - now.getUTCSeconds()),
  };
}
