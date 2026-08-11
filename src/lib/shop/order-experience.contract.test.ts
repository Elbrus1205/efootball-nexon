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
  assert.doesNotMatch(queries, /count\(\{ where: \{ buyerId: userId \} \}\)/);
});

test("order page uses Telegram contacts instead of an internal chat", () => {
  const page = read("src", "app", "shop", "orders", "[id]", "page.tsx");
  const actions = read("src", "components", "shop", "order-actions.tsx");

  assert.match(page, /Telegram/);
  assert.match(page, /telegramUsername/);
  assert.doesNotMatch(page, /order\.messages/);
  assert.doesNotMatch(actions, /\/messages/);
  assert.doesNotMatch(actions, /sendMessage/);
});

test("Telegram order notifications expose the full workflow and review action", () => {
  const workflow = read("src", "lib", "shop", "order-workflow-service.ts");

  assert.match(workflow, /Связаться с покупателем/);
  assert.match(workflow, /Связаться с исполнителем/);
  assert.match(workflow, /Монеты куплены/);
  assert.match(workflow, /Оставить отзыв/);
  assert.match(workflow, /Количество/);
  assert.match(workflow, /Вариант/);
});

test("published reviews show the buyer player profile", () => {
  const reviews = read("src", "app", "shop", "reviews", "page.tsx");

  assert.match(reviews, /buyer:\s*\{\s*select:/);
  assert.match(reviews, /publicId/);
  assert.match(reviews, /\/players\//);
  assert.match(reviews, /reviewStars/);
});

test("buyer can leave a review immediately after confirming receipt", () => {
  const actions = read("src", "components", "shop", "order-actions.tsx");

  assert.match(actions, /const \[currentStatus, setCurrentStatus\] = useState\(props\.status\)/);
  assert.match(actions, /setCurrentStatus\(data\.order\.status\)/);
  assert.match(actions, /currentStatus === "WAITING_BUYER_CONFIRMATION"/);
  assert.match(actions, /currentStatus === "COMPLETED"/);
  assert.match(actions, /scrollIntoView/);
});
