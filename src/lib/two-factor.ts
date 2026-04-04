import crypto from "crypto";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram-bot";
import type { SecurityContext } from "@/lib/auth/security";

export const TWO_FACTOR_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export function generateTwoFactorCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashTwoFactorCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getPurposeLabel(purpose: string) {
  switch (purpose) {
    case "LOGIN":
      return "подтверждения входа";
    case "ENABLE_2FA":
      return "включения 2FA";
    case "DISABLE_2FA":
      return "отключения 2FA";
    default:
      return "подтверждения";
  }
}

function formatTelegramTwoFactorMessage(params: {
  code: string;
  purpose: string;
  context?: SecurityContext;
}) {
  const location = params.context?.location?.trim() || "Не определено";
  const device = params.context?.device?.trim() || "Не определено";
  const ipAddress = params.context?.ipAddress?.trim() || "IP скрыт";
  const purposeLabel = getPurposeLabel(params.purpose);

  return [
    "<b>eFootball Nexon</b>",
    "",
    `Код для ${purposeLabel}:`,
    `<blockquote><tg-spoiler><b>${escapeHtml(params.code)}</b></tg-spoiler></blockquote>`,
    "Нажмите на скрытый код, чтобы открыть его.",
    "",
    "<b>Запрос выполнен с устройства:</b>",
    `${escapeHtml(device)}`,
    "",
    "<b>Локация:</b>",
    `${escapeHtml(location)}`,
    "",
    "<b>IP:</b>",
    `<code>${escapeHtml(ipAddress)}</code>`,
    "",
    "Введите этот код на сайте. Он действует 10 минут.",
  ].join("\n");
}

export async function createTelegramTwoFactorChallenge(params: {
  userId: string;
  telegramId: string;
  purpose: string;
  context?: SecurityContext;
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
    text: formatTelegramTwoFactorMessage({
      code,
      purpose: params.purpose,
      context: params.context,
    }),
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
