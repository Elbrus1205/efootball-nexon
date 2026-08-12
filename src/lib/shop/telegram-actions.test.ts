import assert from "node:assert/strict";
import test from "node:test";
import { handleShopTelegramCallback, type ShopCallbackOrders, type ShopCallbackTokens } from "./telegram-actions";

test("Telegram callback покупателя одноразово отправляет жалобу", async () => {
  let available = true;
  const complaints: string[] = [];
  const tokens: ShopCallbackTokens = { async consume() { if (!available) return null; available = false; return { action: "SHOP_OPEN_DISPUTE", orderId: "order-1" }; } };
  const orders: ShopCallbackOrders = { async openDispute(orderId) { complaints.push(orderId); }, async cancel() {} };
  const first = await handleShopTelegramCallback({ userId: "buyer-1", token: "token-1", tokens, orders });
  const repeated = await handleShopTelegramCallback({ userId: "buyer-1", token: "token-1", tokens, orders });
  assert.match(first.message, /Жалоба отправлена/);
  assert.match(repeated.message, /уже выполнено|истёк/);
  assert.deepEqual(complaints, ["order-1"]);
});
