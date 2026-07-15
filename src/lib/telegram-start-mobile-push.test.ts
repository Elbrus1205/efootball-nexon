import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");

test("Telegram /start sends the branded welcome and linked-user count", () => {
  const webhook = read("src", "app", "api", "telegram", "webhook", "route.ts");

  assert.match(webhook, /db\.user\.count/);
  assert.match(webhook, /Это официальный бот киберспортивной платформы/);
  assert.match(webhook, /В боте зарегистрировано/);
  assert.match(webhook, /sendTelegramMessage/);
});

test("production startup repairs the Telegram webhook", () => {
  const startup = read("scripts", "start-standalone.mjs");

  assert.match(startup, /ensure-telegram-webhook\.mjs/);
});

test("the website notification bell and inbox are removed", () => {
  const authNav = read("src", "components", "layout", "auth-nav.tsx");
  const navbar = read("src", "components", "layout", "navbar.tsx");

  assert.doesNotMatch(authNav, /NotificationMenu|<Bell/);
  assert.doesNotMatch(navbar, /db\.notification\.count/);
});

test("the installed Android app and PWA register phone push notifications", () => {
  const providers = read("src", "components", "providers", "app-providers.tsx");
  const registrar = read("src", "components", "providers", "push-notification-registrar.tsx");
  const notifications = read("src", "lib", "services", "notifications.ts");

  assert.match(providers, /PushNotificationRegistrar/);
  assert.match(registrar, /source.*android/);
  assert.match(registrar, /serviceWorker\.register\("\/sw\.js"/);
  assert.match(notifications, /sendWebPushNotification/);
  assert.doesNotMatch(notifications, /broadcastNotification|Pusher/);
  assert.equal(existsSync(path.join(root, "public", "sw.js")), true);
});
