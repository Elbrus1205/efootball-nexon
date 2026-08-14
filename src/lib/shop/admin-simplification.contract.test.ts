import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");

test("executors have no limits, commission or product assignments", () => {
  const adminPage = read("src", "app", "admin", "shop", "page.tsx");
  const payment = read("src", "lib", "shop", "payment-service.ts");

  assert.doesNotMatch(adminPage, /maxActiveOrders|commissionPercent|assignSellerProduct|Продавец активен/);
  assert.doesNotMatch(payment, /maxActiveOrders|commissionBps|ShopSellerProduct/);
  assert.match(payment, /commissionMinor:\s*0/);
  assert.match(payment, /sellerEarningMinor:\s*order\.totalMinor/);
});

test("admin can safely delete products, categories and executors", () => {
  const adminPage = read("src", "app", "admin", "shop", "page.tsx");
  const route = read("src", "app", "api", "admin", "shop", "route.ts");

  for (const action of ["deleteProduct", "deleteCategory", "removeSeller"]) {
    assert.match(adminPage, new RegExp(`value=["']${action}["']`));
    assert.match(route, new RegExp(`action === ["']${action}["']`));
  }
  assert.match(route, /confirmation.*УДАЛИТЬ/);
  assert.match(route, /deletedAt:\s*new Date\(\)/);
});

test("executor completion immediately exposes Telegram reviews", () => {
  const actions = read("src", "components", "shop", "order-actions.tsx");
  const workflow = read("src", "lib", "shop", "order-workflow-service.ts");

  assert.match(actions, /SELLER_COMPLETE/);
  assert.match(actions, /Заказ выполнен/);
  assert.match(actions, /reviewsUrl/);
  assert.match(workflow, /WAITING_BUYER_CONFIRMATION[\s\S]{0,240}reviewsTelegramUrl/);
});
