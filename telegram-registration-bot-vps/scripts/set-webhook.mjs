import "dotenv/config";

const botToken = requiredEnv("TELEGRAM_BOT_TOKEN");
const webhookSecret = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
const webhookUrl = requiredEnv("BOT_PUBLIC_WEBHOOK_URL");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  }),
});

const payload = await response.json().catch(() => null);
if (!response.ok || !payload?.ok) {
  console.error(payload ?? (await response.text().catch(() => "")));
  process.exit(1);
}

console.log(`Telegram webhook set: ${webhookUrl}`);
