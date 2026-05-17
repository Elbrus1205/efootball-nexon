import "dotenv/config";
import { createServer } from "node:http";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const PORT = Number(process.env.PORT || 3021);
const BOT_TOKEN = requiredEnv("TELEGRAM_BOT_TOKEN");
const WEBHOOK_SECRET = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
const SITE_URL = requiredEnv("SITE_URL").replace(/\/$/, "");

const TOKEN_PREFIX = "telegram-bot-login";
const PENDING_MARKER = "pending";
const VERIFIED_MARKER = "verified";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : null);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function parseTelegramBotLoginStartParam(value) {
  const token = value?.trim().match(/^login_([A-Za-z0-9_-]{20,80})$/)?.[1];
  return token ?? null;
}

function parseTelegramBotLoginIdentifier(identifier) {
  const [prefix, status, legalAccepted, profile] = identifier.split(":");
  if (prefix !== TOKEN_PREFIX) return null;
  if (status === PENDING_MARKER) return { status, legalAccepted: legalAccepted === "1", profile: null };
  if (status === VERIFIED_MARKER && profile) return { status, legalAccepted: legalAccepted === "1", profile };
  return null;
}

function buildVerifiedTelegramBotLoginIdentifier(profile, legalAccepted) {
  const encodedProfile = Buffer.from(JSON.stringify(profile), "utf8").toString("base64url");
  return [TOKEN_PREFIX, VERIFIED_MARKER, legalAccepted ? "1" : "0", encodedProfile].join(":");
}

async function callTelegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram API ${method} failed`);
  }
  return payload.result;
}

async function sendTelegramMessage(chatId, text) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [[{ text: "Вернуться на сайт", url: `${SITE_URL}/login` }]],
    },
  }).catch((error) => {
    console.warn("[telegram-bot] send-message-failed", error.message);
  });
}

async function getTelegramPhotoFileId(telegramId) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos?user_id=${telegramId}&limit=1`, {
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;

  const payload = await response.json().catch(() => null);
  const photos = payload?.result?.photos?.[0] ?? [];
  const bestPhoto = photos
    .filter((photo) => photo.file_id)
    .sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];

  return bestPhoto?.file_id ?? null;
}

async function handleTelegramWebhook(req, res) {
  if (req.headers["x-telegram-bot-api-secret-token"] !== WEBHOOK_SECRET) {
    return json(res, 401, { ok: false });
  }

  const update = await readJson(req);
  const text = update?.message?.text ?? "";
  const startPayload = text.match(/^\/start(?:@\w+)?\s+(.+)$/)?.[1];
  const token = parseTelegramBotLoginStartParam(startPayload);
  const from = update?.message?.from;
  const chatId = update?.message?.chat?.id?.toString();

  if (!token || !from?.id || !chatId) {
    return json(res, 200, { ok: true });
  }

  const telegramId = String(from.id);
  console.info("[telegram-bot] token-received", { token, telegramId, username: from.username ?? null });

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    if (record) await db.verificationToken.delete({ where: { token } }).catch(() => null);
    await sendTelegramMessage(chatId, "Ссылка для входа истекла. Вернитесь на сайт и запустите вход через Telegram еще раз.");
    return json(res, 200, { ok: true });
  }

  const parsed = parseTelegramBotLoginIdentifier(record.identifier);
  if (!parsed) {
    await db.verificationToken.delete({ where: { token } }).catch(() => null);
    await sendTelegramMessage(chatId, "Эта ссылка больше недействительна. Запросите новый вход на сайте.");
    return json(res, 200, { ok: true });
  }

  if (parsed.status === VERIFIED_MARKER) {
    await sendTelegramMessage(chatId, "Этот вход уже подтвержден. Вернитесь на сайт, авторизация завершится автоматически.");
    return json(res, 200, { ok: true });
  }

  const photoFileId = await getTelegramPhotoFileId(telegramId);
  const identifier = buildVerifiedTelegramBotLoginIdentifier(
    {
      id: telegramId,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      username: from.username ?? null,
      photoFileId,
    },
    parsed.legalAccepted,
  );

  await db.verificationToken.update({
    where: { token },
    data: { identifier },
  });

  await sendTelegramMessage(chatId, "Готово. Вернитесь на сайт, вход или регистрация завершатся автоматически.");
  return json(res, 200, { ok: true });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/telegram/webhook") {
      return await handleTelegramWebhook(req, res);
    }

    return json(res, 404, { ok: false, error: "not-found" });
  } catch (error) {
    console.error("[telegram-bot] request-failed", error);
    return json(res, 500, { ok: false });
  }
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  console.info("[telegram-bot] shutting down");
  server.close();
  await db.$disconnect();
  process.exit(0);
}

server.listen(PORT, () => {
  console.info(`[telegram-bot] listening on :${PORT}`);
});
