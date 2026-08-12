import assert from "node:assert/strict";
import test from "node:test";

import { OrderTransitionError, assertOrderTransition } from "./order-state-machine";

test("оплаченный заказ сразу назначает��я и запускается", () => {
  const flow = [
    ["PENDING_PAYMENT", "PAID", "SYSTEM"],
    ["PAID", "IN_PROGRESS", "SYSTEM"],
    ["IN_PROGRESS", "COMPLETED", "SYSTEM"],
  ] as const;

  for (const [from, to, actor] of flow) {
    assert.doesNotThrow(() => assertOrderTransition({ from, to, actor }));
  }
});

test("продавец не может сам завершить заказ", () => {
  assert.throws(
    () => assertOrderTransition({ from: "IN_PROGRESS", to: "COMPLETED", actor: "SELLER" }),
    (error: unknown) => error instanceof OrderTransitionError && error.code === "ACTOR_NOT_ALLOWED",
  );
});

test("покупатель может открыть спор на исполняемом заказе", () => {
  assert.doesNotThrow(() => assertOrderTransition({ from: "IN_PROGRESS", to: "DISPUTE", actor: "BUYER" }));
  assert.throws(() => assertOrderTransition({ from: "PENDING_PAYMENT", to: "DISPUTE", actor: "BUYER" }), /недоступен/);
});

test("поддержка может направить спор на возврат, но продавец не может", () => {
  assert.doesNotThrow(() => assertOrderTransition({ from: "DISPUTE", to: "REFUND_PENDING", actor: "SUPPORT" }));
  assert.throws(
    () => assertOrderTransition({ from: "DISPUTE", to: "REFUND_PENDING", actor: "SELLER" }),
    (error: unknown) => error instanceof OrderTransitionError && error.code === "ACTOR_NOT_ALLOWED",
  );
  assert.doesNotThrow(() => assertOrderTransition({ from: "REFUND_PENDING", to: "REFUNDED", actor: "SYSTEM" }));
});
