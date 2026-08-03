import assert from "node:assert/strict";
import test from "node:test";

import { OrderTransitionError, assertOrderTransition } from "./order-state-machine";

test("заказ проходит подтверждённый сценарий исполнения", () => {
  const flow = [
    ["PENDING_PAYMENT", "PAID", "SYSTEM"],
    ["PAID", "WAITING_SELLER", "SYSTEM"],
    ["WAITING_SELLER", "ACCEPTED", "SELLER"],
    ["ACCEPTED", "IN_PROGRESS", "SELLER"],
    ["IN_PROGRESS", "SELLER_COMPLETED", "SELLER"],
    ["SELLER_COMPLETED", "WAITING_BUYER_CONFIRMATION", "SYSTEM"],
    ["WAITING_BUYER_CONFIRMATION", "COMPLETED", "BUYER"],
  ] as const;

  for (const [from, to, actor] of flow) {
    assert.doesNotThrow(() => assertOrderTransition({ from, to, actor }));
  }
});

test("продавец не может пропустить подтверждение покупателя", () => {
  assert.throws(
    () => assertOrderTransition({ from: "IN_PROGRESS", to: "COMPLETED", actor: "SELLER" }),
    (error: unknown) => error instanceof OrderTransitionError && error.code === "TRANSITION_NOT_ALLOWED",
  );
});

test("покупатель может открыть спор только на исполняемом заказе", () => {
  assert.doesNotThrow(() => assertOrderTransition({ from: "WAITING_BUYER_CONFIRMATION", to: "DISPUTE", actor: "BUYER" }));
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
