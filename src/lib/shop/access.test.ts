import assert from "node:assert/strict";
import test from "node:test";

import { canPerformShopAction } from "./access";

const base = {
  userId: "user-1",
  buyerId: "buyer-1",
  sellerUserId: "seller-1",
  permissions: [] as string[],
};

test("контекстный продавец может исполнять назначенный заказ, но не менять цену", () => {
  const seller = { ...base, userId: "seller-1", isActiveSeller: true };

  assert.equal(canPerformShopAction("START_ORDER", seller), true);
  assert.equal(canPerformShopAction("MARK_SELLER_COMPLETED", seller), true);
  assert.equal(canPerformShopAction("CHANGE_ORDER_PRICE", seller), false);
});

test("покупатель подтверждает только свой заказ", () => {
  assert.equal(canPerformShopAction("CONFIRM_ORDER", { ...base, userId: "buyer-1" }), true);
  assert.equal(canPerformShopAction("CONFIRM_ORDER", base), false);
});

test("поддержка разрешает спор, но не управляет каталогом", () => {
  const support = { ...base, permissions: ["shop.support"] };

  assert.equal(canPerformShopAction("RESOLVE_DISPUTE", support), true);
  assert.equal(canPerformShopAction("MANAGE_CATALOG", support), false);
});

test("администратор магазина управляет каталогом и сохраняет аудит", () => {
  const admin = { ...base, permissions: ["shop.manage"] };

  assert.equal(canPerformShopAction("MANAGE_CATALOG", admin), true);
  assert.equal(canPerformShopAction("VIEW_INTERNAL_AUDIT", admin), true);
});
