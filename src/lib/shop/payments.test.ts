import assert from "node:assert/strict";
import test from "node:test";

import { handlePaymentWebhook, type PaymentProvider, type PaymentWebhookStore } from "./payments";

test("подтверждённый webhook оплачивает заказ ровно один раз", async () => {
  const claimed = new Set<string>();
  const confirmations: string[] = [];
  const provider: PaymentProvider = {
    name: "test",
    async createPayment() {
      throw new Error("not used");
    },
    async verifyWebhook() {
      return {
        eventId: "evt-1",
        externalPaymentId: "pay-1",
        status: "SUCCEEDED",
        amountMinor: 149_000,
        currency: "RUB",
        occurredAt: new Date("2026-08-03T12:00:00.000Z"),
      };
    },
    async refundPayment() {
      throw new Error("not used");
    },
  };
  const store: PaymentWebhookStore = {
    async claimEvent(eventId) {
      if (claimed.has(eventId)) return false;
      claimed.add(eventId);
      return true;
    },
    async getPaymentByExternalId() {
      return { id: "payment-1", orderId: "order-1", amountMinor: 149_000, currency: "RUB", status: "PENDING" };
    },
    async confirmPayment(input) {
      confirmations.push(input.orderId);
    },
    async cancelPayment() {},
    async failEvent() {},
  };

  const first = await handlePaymentWebhook({ provider, store, headers: new Headers(), body: "{}" });
  const repeated = await handlePaymentWebhook({ provider, store, headers: new Headers(), body: "{}" });

  assert.deepEqual(first, { accepted: true, duplicate: false, orderId: "order-1", status: "SUCCEEDED" });
  assert.deepEqual(repeated, { accepted: true, duplicate: true });
  assert.deepEqual(confirmations, ["order-1"]);
});

test("webhook с подменённой суммой не оплачивает заказ", async () => {
  const provider: PaymentProvider = {
    name: "test",
    async createPayment() { throw new Error("not used"); },
    async verifyWebhook() {
      return { eventId: "evt-2", externalPaymentId: "pay-2", status: "SUCCEEDED", amountMinor: 1, currency: "RUB", occurredAt: new Date() };
    },
    async refundPayment() { throw new Error("not used"); },
  };
  let confirmed = false;
  const store: PaymentWebhookStore = {
    async claimEvent() { return true; },
    async getPaymentByExternalId() {
      return { id: "payment-2", orderId: "order-2", amountMinor: 149_000, currency: "RUB", status: "PENDING" };
    },
    async confirmPayment() { confirmed = true; },
    async cancelPayment() {},
    async failEvent() {},
  };

  await assert.rejects(
    handlePaymentWebhook({ provider, store, headers: new Headers(), body: "{}" }),
    /сумма платежа/i,
  );
  assert.equal(confirmed, false);
});


test("?????????? webhook ????? ???????? ???????????? ?????", async () => {
  const provider: PaymentProvider = {
    name: "test",
    async createPayment() { throw new Error("not used"); },
    async verifyWebhook() {
      return { eventId: "evt-cancel", externalPaymentId: "pay-cancel", status: "CANCELLED", amountMinor: 149_000, currency: "RUB", occurredAt: new Date() };
    },
    async refundPayment() { throw new Error("not used"); },
  };
  const cancellations: string[] = [];
  const store = {
    async claimEvent() { return true; },
    async getPaymentByExternalId() {
      return { id: "payment-cancel", orderId: "order-cancel", amountMinor: 149_000, currency: "RUB", status: "PENDING" };
    },
    async confirmPayment() {},
    async cancelPayment(input: { orderId: string }) { cancellations.push(input.orderId); },
    async failEvent() {},
  } satisfies PaymentWebhookStore;

  const result = await handlePaymentWebhook({ provider, store, headers: new Headers(), body: "{}" });

  assert.deepEqual(result, { accepted: true, duplicate: false, orderId: "order-cancel", status: "CANCELLED" });
  assert.deepEqual(cancellations, ["order-cancel"]);
});
