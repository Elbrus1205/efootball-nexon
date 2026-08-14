import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");

test("buyer history contains only paid orders", () => {
  const queries = read("src", "lib", "shop", "order-queries.ts");
  assert.match(queries, /buyerOrderHistoryWhere/);
  assert.match(queries, /payments:\s*\{\s*some:\s*\{\s*status:\s*ShopPaymentStatus\.SUCCEEDED/);
});

test("paid order is assigned and started atomically without acceptance or start confirmations", () => {
  const payment = read("src", "lib", "shop", "payment-service.ts");
  const actions = read("src", "components", "shop", "order-actions.tsx");
  const telegram = read("src", "lib", "shop", "order-workflow-service.ts");

  assert.match(payment, /status:\s*ShopOrderStatus\.IN_PROGRESS/);
  assert.match(payment, /sellerId:\s*seller\.id/);
  assert.match(payment, /getShopComplaintExpiresAt/);
  assert.doesNotMatch(actions, /SHOP_ACCEPT_ORDER|SHOP_START_ORDER|SHOP_BUYER_CONFIRM/);
  assert.match(actions, /SELLER_COMPLETE/);
  assert.doesNotMatch(telegram, /SHOP_ACCEPT_ORDER|SHOP_START_ORDER|SHOP_SELLER_COMPLETE|SHOP_BUYER_CONFIRM/);
});

test("buyer complaint is available for 48 hours and seller cannot open it", () => {
  const workflow = read("src", "lib", "shop", "order-workflow-service.ts");
  const access = read("src", "lib", "shop", "access.ts");
  const actions = read("src", "components", "shop", "order-actions.tsx");

  assert.match(workflow, /SHOP_COMPLAINT_WINDOW_EXPIRED/);
  assert.match(actions, /complaintExpiresAt/);
  assert.match(actions, /props\.status !== "IN_PROGRESS"/);
  assert.match(actions, /Пожаловаться/);
  assert.doesNotMatch(access, /case "OPEN_DISPUTE":[\s\S]{0,160}isSeller/);
});

test("reviews are external Telegram links, never an in-site form", () => {
  const shop = read("src", "app", "shop", "page.tsx");
  const product = read("src", "app", "shop", "[slug]", "page.tsx");
  const reviewRoute = read("src", "app", "api", "shop", "orders", "[id]", "review", "route.ts");
  const workflow = read("src", "lib", "shop", "order-workflow-service.ts");

  assert.match(shop, /settings\.reviewsTelegramUrl/);
  assert.match(workflow, /reviewsTelegramUrl/);
  assert.match(read("src", "app", "shop", "reviews", "page.tsx"), /redirect\(settings\.reviewsTelegramUrl/);
  assert.doesNotMatch(product, /product\.reviews|Отз��вы игроков|reviewStars/);
  assert.match(reviewRoute, /status:\s*410/);
});

test("order pages are compact and mobile lists do not use tables", () => {
  const detail = read("src", "app", "shop", "orders", "[id]", "page.tsx");
  const orders = read("src", "app", "shop", "orders", "page.tsx");
  const css = read("src", "components", "shop", "shop.module.css");

  assert.doesNotMatch(detail, /Назад к заказам|Цена зафиксирована|Данные для выполнения/);
  assert.doesNotMatch(orders, /<table|tableWrap/);
  assert.match(orders, /orderList/);
  assert.match(css, /\.orderList/);
  assert.match(css, /\.orderCard/);
});

test("shop notifications request immediate outbox delivery", () => {
  const workflow = read("src", "lib", "shop", "order-workflow-service.ts");
  const worker = read("src", "lib", "notifications", "delivery-worker.ts");

  assert.match(workflow, /deliverNotificationsImmediately/);
  assert.match(worker, /export async function deliverNotificationsImmediately/);
});
