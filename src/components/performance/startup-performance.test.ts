import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");

test("startup path does not block first paint with analytics or dashboard maintenance", () => {
  const layout = read("src", "app", "layout.tsx");
  const dashboard = read("src", "app", "dashboard", "page.tsx");

  assert.match(layout, /<Script id="yandex-metrika" strategy="lazyOnload">/);
  assert.doesNotMatch(dashboard, /syncUserAchievements|notifyExpiredProfileStatuses/);
});

test("Telegram Mini App authentication has a bounded SDK wait", () => {
  const telegram = read("src", "components", "telegram", "telegram-mini-app-auto-login.tsx");

  assert.match(telegram, /TELEGRAM_WEB_APP_WAIT_ATTEMPTS = 10/);
  assert.match(telegram, /TELEGRAM_WEB_APP_WAIT_DELAY_MS = 100/);
});
