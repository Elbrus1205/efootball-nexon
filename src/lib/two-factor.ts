import crypto from "crypto";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram-bot";

export const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export function generateTwoFactorCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashTwoFactorCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function createTelegramTwoFactorChallenge(params: {
  userId: string;
  telegramId: string;
  purpose: string;
}) {
  const code = generateTwoFactorCode();
  const token = crypto.randomUUID();

  await db.twoFactorChallenge.updateMany({
    where: {
      userId: params.userId,
      purpose: params.purpose,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  await db.twoFactorChallenge.create({
    data: {
      token,
      userId: params.userId,
      purpose: params.purpose,
      codeHash: hashTwoFactorCode(code),
      expiresAt: new Date(Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS),
    },
  });

  await sendTelegramMessage({
    chatId: params.telegramId,
    text: [
      "Efootball Nexon",
      "",
      "Код подтверждения:",
      `<b>${code}</b>`,
      "",
      "Введите этот код на сайте. Он действует 10 минут.",
    ].join("\n"),
  });

  return token;
}

export async function verifyTwoFactorChallenge(params: {
  userId: string;
  token: string;
  code: string;
  purpose: string;
}) {
  const codeHash = hashTwoFactorCode(params.code);

  const challenge = await db.twoFactorChallenge.findFirst({
    where: {
      token: params.token,
      userId: params.userId,
      purpose: params.purpose,
      codeHash,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!challenge) {
    return null;
  }

  await db.twoFactorChallenge.update({
    where: { id: challenge.id },
    data: {
      usedAt: new Date(),
    },
  });

  return challenge;
}
