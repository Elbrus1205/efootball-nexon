import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { ShopError } from "@/lib/shop/errors";
import { createCasheraProvider, getCasheraReadiness } from "@/lib/shop/cashera-provider";

const originalFetch = globalThis.fetch;
const originalEnv = {
  CASHERA_BASE_URL: process.env.CASHERA_BASE_URL,
  CASHERA_API_KEY: process.env.CASHERA_API_KEY,
  CASHERA_API_SECRET: process.env.CASHERA_API_SECRET,
  CASHERA_PAYMENT_METHOD: process.env.CASHERA_PAYMENT_METHOD,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

test("reports missing Cashera credentials", () => {
  delete process.env.CASHERA_API_KEY;
  delete process.env.CASHERA_API_SECRET;

  const readiness = getCasheraReadiness();

  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.missing, ["CASHERA_API_KEY", "CASHERA_API_SECRET"]);
});

test("creates a Cashera checkout in minor units", async () => {
  configureCashera();
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify({
      uuid: "trx-1",
      status: "pending",
      payment_url: "pay.cashera.cash/trx-1",
      expires_at: "2026-08-25T12:15:00+00:00",
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const payment = await createCasheraProvider().createPayment({
    orderId: "order-1",
    orderNumber: "NEX-100",
    userId: "buyer-1",
    amountMinor: 149_050,
    currency: "RUB",
    description: "Order NEX-100",
    returnUrl: "https://shop.example/shop/orders/order-1",
    idempotencyKey: "shop-order:order-1:payment:v1",
  });

  assert.equal(requestUrl, "https://api.cashera.cash/api/v1/integration/transactions");
  assert.equal(requestInit?.method, "POST");
  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get("X-Api-Key"), "pk_test");
  assert.equal(headers.has("X-Secret"), false);

  const body = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
  assert.equal(body.amount, 149_050);
  assert.equal(body.currency, "RUB");
  assert.equal(body.payment_method, "sbp");
  assert.equal(body.external_id, "shop-order:order-1:payment:v1");
  assert.equal(body.callback_url, "https://shop.example/api/shop/payments/webhook/cashera");
  assert.equal(body.success_url, "https://shop.example/shop/orders/order-1?payment=success");
  assert.equal(body.fail_url, "https://shop.example/shop/orders/order-1?payment=failed");

  assert.equal(payment.externalPaymentId, "trx-1");
  assert.equal(payment.checkoutUrl, "https://pay.cashera.cash/trx-1");
  assert.equal(payment.expiresAt?.toISOString(), "2026-08-25T12:15:00.000Z");
});

test("verifies a paid Cashera webhook", async () => {
  configureCashera();

  const event = await createCasheraProvider().verifyWebhook({
    headers: new Headers({ "X-Api-Key": "pk_test", "X-Secret": "sk_test" }),
    body: JSON.stringify({
      event: "transaction.status_updated",
      transaction: {
        uuid: "trx-1",
        external_id: "shop-order:order-1:payment:v1",
        status: "paid",
        amount: 149_050,
        currency: "RUB",
        paid_at: "2026-08-25T12:10:00+00:00",
      },
    }),
  });

  assert.ok(event);
  assert.equal(event.externalPaymentId, "trx-1");
  assert.equal(event.status, "SUCCEEDED");
  assert.equal(event.amountMinor, 149_050);
  assert.equal(event.eventId, "trx-1:paid");
  assert.equal(event.occurredAt.toISOString(), "2026-08-25T12:10:00.000Z");
});

test("rejects a Cashera webhook with invalid credentials", async () => {
  configureCashera();

  await assert.rejects(
    createCasheraProvider().verifyWebhook({
      headers: new Headers({ "X-Api-Key": "pk_wrong", "X-Secret": "sk_test" }),
      body: JSON.stringify({ event: "webhook.test", test: { sent_at: new Date().toISOString() } }),
    }),
    (error) => error instanceof ShopError && error.code === "CASHERA_WEBHOOK_API_KEY_MISMATCH",
  );
});

test("ignores an authenticated Cashera test webhook", async () => {
  configureCashera();

  const event = await createCasheraProvider().verifyWebhook({
    headers: new Headers({ "X-Api-Key": "pk_test", "X-Secret": "sk_test" }),
    body: JSON.stringify({ event: "webhook.test", test: { sent_at: new Date().toISOString() } }),
  });

  assert.equal(event, null);
});

function configureCashera() {
  process.env.CASHERA_BASE_URL = "https://api.cashera.cash/api/v1/";
  process.env.CASHERA_API_KEY = "pk_test";
  process.env.CASHERA_API_SECRET = "sk_test";
  process.env.CASHERA_PAYMENT_METHOD = "sbp";
}

function restoreEnv() {
  for (const [name, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
