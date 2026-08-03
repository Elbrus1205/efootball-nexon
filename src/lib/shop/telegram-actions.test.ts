import assert from "node:assert/strict";
import test from "node:test";

import { handleShopTelegramCallback, type ShopCallbackOrders, type ShopCallbackTokens } from "./telegram-actions";

test("Telegram callback продавца одноразово принимает заказ", async () => {
  let available = true;
  const accepted: Array<{ orderId: string; userId: string }> = [];
  const tokens: ShopCallbackTokens = {
    async consume() {
      if (!available) return null;
      available = false;
      return { action: "SHOP_ACCEPT_ORDER", orderId: "order-1" };
    },
  };
  const orders: ShopCallbackOrders = {
    async accept(orderId, userId) { accepted.push({ orderId, userId }); },
    async start() {},
    async sellerComplete() {},
    async buyerConfirm() {},
    async openDispute() {},
    async cancel() {},
  };

  const first = await handleShopTelegramCallback({ userId: "seller-1", token: "token-1", tokens, orders });
  const repeated = await handleShopTelegramCallback({ userId: "seller-1", token: "token-1", tokens, orders });

  assert.equal(first.clearKeyboard, true);
  assert.match(first.message, /принят/);
  assert.match(repeated.message, /уже выполнено|истёк/);
  assert.deepEqual(accepted, [{ orderId: "order-1", userId: "seller-1" }]);
});
