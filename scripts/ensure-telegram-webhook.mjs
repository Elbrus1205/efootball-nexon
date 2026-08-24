import crypto from "node:crypto";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Telegram webhook check was skipped.");
  process.exit(0);
}

const explicitSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
if (!explicitSecret && !nextAuthSecret) {
  console.error("TELEGRAM_WEBHOOK_SECRET or NEXTAUTH_SECRET is required to configure the Telegram webhook.");
  process.exit(1);
}

const webhookSecret = explicitSecret
  || crypto.createHash("sha256").update(`${nextAuthSecret}:telegram-webhook`).digest("hex");
const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
const baseUrl = configuredBaseUrl && /^https:\/\/[^/]+/i.test(configuredBaseUrl)
  ? configuredBaseUrl.replace(/\/$/, "")
  : "https://efootball-nexon.com";
const webhookUrl = `${baseUrl}/api/telegram/webhook`;
const apiBase = `https://api.telegram.org/bot${token}`;

async function callTelegram(method, body) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/${method}`, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.description || `Telegram API ${method} failed`);
      }
      return payload.result;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
  throw lastError;
}

const current = await callTelegram("getWebhookInfo");
const requiredUpdates = ["message", "edited_message", "channel_post", "edited_channel_post", "callback_query"];
const hasRequiredUpdates = requiredUpdates.every((update) => current?.allowed_updates?.includes(update));
if (current?.url === webhookUrl && !current?.last_error_message && hasRequiredUpdates) {
  console.log(`Telegram webhook is ready: ${webhookUrl}`);
  process.exit(0);
}

await callTelegram("setWebhook", {
  url: webhookUrl,
  secret_token: webhookSecret,
  allowed_updates: requiredUpdates,
  drop_pending_updates: false,
});
console.log(`Telegram webhook updated: ${webhookUrl}`);
