import assert from "node:assert/strict";
import test from "node:test";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";

test("callback buttons render callback_data and omit url", () => {
  const markup = buildTelegramInlineKeyboard([
    { text: "Принять", callbackData: "inv_acc:t1", row: 1 },
    { text: "Отклонить", callbackData: "inv_dec:t1", row: 1 },
  ]);

  assert.ok(markup);
  const [row] = markup.inline_keyboard;
  assert.equal(row.length, 2);
  assert.equal(row[0].callback_data, "inv_acc:t1");
  assert.equal(row[0].url, undefined);
  // Callback buttons must not carry the link-only custom emoji icon.
  assert.equal(row[0].icon_custom_emoji_id, undefined);
});

test("url and callback buttons coexist on separate rows", () => {
  const markup = buildTelegramInlineKeyboard([
    { text: "Подтвердить счёт 3:1", callbackData: "tok:abc", row: 1 },
    { text: "Открыть матч", url: "https://example.com/m", row: 2 },
  ]);

  assert.ok(markup);
  assert.equal(markup.inline_keyboard.length, 2);
  assert.equal(markup.inline_keyboard[0][0].callback_data, "tok:abc");
  assert.equal(markup.inline_keyboard[1][0].url, "https://example.com/m");
  assert.equal(markup.inline_keyboard[1][0].callback_data, undefined);
});

test("buttons without url or callbackData are dropped", () => {
  const markup = buildTelegramInlineKeyboard([
    { text: "Пусто", row: 1 },
    { text: "Ссылка", url: "https://example.com", row: 1 },
  ]);

  assert.ok(markup);
  assert.equal(markup.inline_keyboard[0].length, 1);
  assert.equal(markup.inline_keyboard[0][0].url, "https://example.com");
});

test("keyboard is undefined when every button is empty", () => {
  const markup = buildTelegramInlineKeyboard([{ text: "Пусто", row: 1 }]);
  assert.equal(markup, undefined);
});
