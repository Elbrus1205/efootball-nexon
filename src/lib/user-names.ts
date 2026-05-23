import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateFallbackName } from "@/lib/player-name";

const PLAYER_NAME_PATTERN = /^(?!.*__)[A-Za-z0-9][A-Za-z0-9_]{1,14}[A-Za-z0-9]$/;

export const DISPLAY_NAME_TAKEN_MESSAGE = "Такое имя уже существует";

export function normalizeDisplayName(name: string) {
  return name.trim();
}

function sanitizeDisplayNameCandidate(value?: string | null) {
  const normalized = value
    ?.trim()
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) return null;

  const clipped = normalized.slice(0, 16).replace(/^_+|_+$/g, "");
  return PLAYER_NAME_PATTERN.test(clipped) ? clipped : null;
}

export async function isDisplayNameTaken(name: string, excludeUserId?: string) {
  const normalized = normalizeDisplayName(name);
  if (!normalized) return false;

  const user = await db.user.findFirst({
    where: {
      name: {
        equals: normalized,
        mode: "insensitive",
      },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  return Boolean(user);
}

export async function generateUniqueDisplayName(seed: string, preferredName?: string | null, excludeUserId?: string) {
  const preferredCandidate = sanitizeDisplayNameCandidate(preferredName);
  if (preferredCandidate && !(await isDisplayNameTaken(preferredCandidate, excludeUserId))) {
    return preferredCandidate;
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = sanitizeDisplayNameCandidate(generateFallbackName(`${seed || "player"}:${attempt}:${randomUUID()}`));

    if (candidate && !(await isDisplayNameTaken(candidate, excludeUserId))) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = `Player${randomUUID().replace(/-/g, "").slice(0, 10)}`;

    if (!(await isDisplayNameTaken(candidate, excludeUserId))) {
      return candidate;
    }
  }

  return `P${Date.now().toString(36).slice(0, 15)}`;
}

export function isDisplayNameUniqueError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((item) => String(item).toLowerCase().includes("name"));
  }

  return String(target ?? "").toLowerCase().includes("name");
}
