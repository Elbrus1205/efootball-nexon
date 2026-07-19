import { db } from "@/lib/db";
import {
  getTelegramChat,
  isTelegramRecipientUnavailableError,
  normalizeTelegramUsername,
} from "@/lib/telegram-bot";

export type TelegramUsernameSyncOutcome =
  | "updated" // stored username differed and was refreshed
  | "unchanged" // stored username already matched Telegram
  | "unavailable" // bot can't read the chat (blocked / never started / deactivated)
  | "error"; // unexpected Telegram or database failure

export type TelegramUsernameSyncResult = {
  userId: string;
  outcome: TelegramUsernameSyncOutcome;
  previousUsername: string | null;
  currentUsername: string | null;
};

/**
 * Pure decision: does the stored username need to change to match Telegram?
 * Kept separate from IO so it can be unit-tested without the network.
 */
export function resolveUsernameChange(
  storedUsername: string | null | undefined,
  liveUsername: string | null | undefined,
): { changed: boolean; nextUsername: string | null } {
  const stored = normalizeTelegramUsername(storedUsername);
  const next = normalizeTelegramUsername(liveUsername);
  return { changed: stored !== next, nextUsername: next };
}

type SyncableUser = {
  id: string;
  telegramId: string | null;
  telegramUsername: string | null;
};

/**
 * Fetches the live Telegram username for one linked user and persists it when
 * it has changed. Safe to call on demand (button) or in bulk (cron).
 */
export async function syncTelegramUsernameForUser(user: SyncableUser): Promise<TelegramUsernameSyncResult> {
  const base = {
    userId: user.id,
    previousUsername: user.telegramUsername,
    currentUsername: user.telegramUsername,
  };

  if (!user.telegramId) {
    return { ...base, outcome: "unavailable" };
  }

  try {
    const chat = await getTelegramChat(user.telegramId);
    const { changed, nextUsername } = resolveUsernameChange(user.telegramUsername, chat.username);

    if (!changed) {
      return { ...base, outcome: "unchanged", currentUsername: nextUsername };
    }

    await db.user.update({
      where: { id: user.id },
      data: { telegramUsername: nextUsername },
    });

    return { ...base, outcome: "updated", currentUsername: nextUsername };
  } catch (error) {
    if (isTelegramRecipientUnavailableError(error)) {
      return { ...base, outcome: "unavailable" };
    }
    console.error("Telegram username sync failed", { userId: user.id, error });
    return { ...base, outcome: "error" };
  }
}

export async function syncTelegramUsernameById(userId: string): Promise<TelegramUsernameSyncResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, telegramId: true, telegramUsername: true },
  });

  if (!user) {
    return { userId, outcome: "error", previousUsername: null, currentUsername: null };
  }

  return syncTelegramUsernameForUser(user);
}

export type TelegramUsernameSyncSummary = {
  scanned: number;
  updated: number;
  unchanged: number;
  unavailable: number;
  errors: number;
};

/**
 * Refreshes every linked user's Telegram username. Runs in small sequential
 * batches with a short pause so we stay within Telegram's rate limits.
 */
export async function syncAllTelegramUsernames(options?: {
  batchSize?: number;
  pauseMs?: number;
}): Promise<TelegramUsernameSyncSummary> {
  const batchSize = Math.max(1, options?.batchSize ?? 25);
  const pauseMs = Math.max(0, options?.pauseMs ?? 1_000);

  const users = await db.user.findMany({
    where: { telegramId: { not: null }, isBanned: false },
    select: { id: true, telegramId: true, telegramUsername: true },
  });

  const summary: TelegramUsernameSyncSummary = {
    scanned: users.length,
    updated: 0,
    unchanged: 0,
    unavailable: 0,
    errors: 0,
  };

  for (let index = 0; index < users.length; index += batchSize) {
    const batch = users.slice(index, index + batchSize);
    const results = await Promise.all(batch.map((user) => syncTelegramUsernameForUser(user)));

    for (const result of results) {
      if (result.outcome === "updated") summary.updated += 1;
      else if (result.outcome === "unchanged") summary.unchanged += 1;
      else if (result.outcome === "unavailable") summary.unavailable += 1;
      else summary.errors += 1;
    }

    if (pauseMs && index + batchSize < users.length) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }

  return summary;
}
