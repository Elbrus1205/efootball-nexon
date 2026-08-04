import assert from "node:assert/strict";
import test from "node:test";
import { parseTelegramChatUrl } from "./telegram-url";

test("ссылка отзывов принимает только публичные HTTPS-ссылки Telegram", () => {
  assert.equal(parseTelegramChatUrl("https://t.me/efootball_reviews"), "https://t.me/efootball_reviews");
  assert.equal(parseTelegramChatUrl("t.me/+AbCdEf123"), "https://t.me/+AbCdEf123");
  assert.equal(parseTelegramChatUrl(""), null);
});

test("ссылка отзывов отклоняет посторонние и небезопасные адреса", () => {
  assert.throws(() => parseTelegramChatUrl("https://example.com/reviews"), /Telegram/);
  assert.throws(() => parseTelegramChatUrl("javascript:alert(1)"), /Telegram/);
  assert.throws(() => parseTelegramChatUrl("https://t.me/"), /Telegram/);
});
