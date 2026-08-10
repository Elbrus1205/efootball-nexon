import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { ShopError } from "@/lib/shop/errors";
import { createPlategaProvider, getPlategaReadiness } from "@/lib/shop/platega-provider";

const originalFetch = globalThis.fetch;
const originalEnv = {
  PLATEGA_BASE_URL: process.env.PLATEGA_BASE_URL,
  PLATEGA_MERCHANT_ID: process.env.PLATEGA_MERCHANT_ID,
  PLATEGA_SECRET: process.env.PLATEGA_SECRET,
  PLATEGA_WEBHOOK_SECRET: process.env.PLATEGA_WEBHOOK_SECRET,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreEnv();
});

test("reports missing Platega credentials", () => {
  delete process.env.PLATEGA_MERCHANT_ID;
  delete process.env.PLATEGA_SECRET;

  const readiness = getPlategaReadiness();

  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.missing, ["PLATEGA_MERCHANT_ID", "PLATEGA_SECRET"]);
});

test("creates a Platega checkout payment", async () => {
  configurePlatega();
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(
      JSON.stringify({
        transactionId: "trx-1",
        url: "https://pay.example/checkout",
        expiresIn: "00:15:00",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const before = Date.now();
  const payment = await createPlategaProvider().createPayment({
    orderId: "order-1",
    orderNumber: "NEX-100",
    amountMinor: 149_050,
    currency: "RUB",
    description: "Order NEX-100",
    returnUrl: "https://shop.example/orders/order-1",
    idempotencyKey: "pay-1",
  });

  assert.equal(requestUrl, "https://app.platega.io/v2/transaction/process");
  assert.equal(requestInit?.method, "POST");

  const headers = new Headers(requestInit?.headers);
  assert.equal(headers.get("X-MerchantId"), "merchant-1");
  assert.equal(headers.get("X-Secret"), "secret-1");

  const body = JSON.parse(String(requestInit?.body)) as Record<string, unknown>;
  assert.deepEqual(body.paymentDetails, { amount: 1490.5, currency: "RUB" });
  assert.equal(body.return, "https://shop.example/orders/order-1");
  assert.equal(body.failedUrl, "https://shop.example/orders/order-1?payment=failed");
  assert.equal(body.payload, "order-1");

  assert.equal(payment.externalPaymentId, "trx-1");
  assert.equal(payment.checkoutUrl, "https://pay.example/checkout");
  assert.ok(payment.expiresAt);
  assert.ok(payment.expiresAt.getTime() >= before + 14 * 60 * 1000);
});

test("verifies a confirmed Platega webhook", async () => {
  configurePlatega();

  const event = await createPlategaProvider().verifyWebhook({
    headers: new Headers({
      "X-MerchantId": "merchant-1",
      "X-Secret": "secret-1",
    }),
    body: JSON.stringify({
      id: "trx-1",
      amount: 1490.5,
      currency: "RUB",
      status: "CONFIRMED",
      paymentMethod: 11,
    }),
  });

  assert.equal(event.externalPaymentId, "trx-1");
  assert.equal(event.status, "SUCCEEDED");
  assert.equal(event.amountMinor, 149_050);
  assert.equal(event.currency, "RUB");
  assert.equal(event.eventId, "trx-1:CONFIRMED:149050:RUB");
});

test("uses a dedicated Platega webhook secret when configured", async () => {
  configurePlatega();
  process.env.PLATEGA_WEBHOOK_SECRET = "webhook-secret";
  const provider = createPlategaProvider();
  const body = JSON.stringify({
    id: "trx-1",
    amount: 10,
    currency: "RUB",
    status: "PENDING",
  });

  await assert.rejects(
    provider.verifyWebhook({
      headers: new Headers({
        "X-MerchantId": "merchant-1",
        "X-Secret": "secret-1",
      }),
      body,
    }),
    (error) => error instanceof ShopError && error.code === "PLATEGA_WEBHOOK_SECRET_MISMATCH",
  );

  const event = await provider.verifyWebhook({
    headers: new Headers({
      "X-MerchantId": "merchant-1",
      "X-Secret": "webhook-secret",
    }),
    body,
  });

  assert.equal(event.status, "PENDING");
});

function configurePlatega() {
  process.env.PLATEGA_BASE_URL = "https://app.platega.io/";
  process.env.PLATEGA_MERCHANT_ID = "merchant-1";
  process.env.PLATEGA_SECRET = "secret-1";
  delete process.env.PLATEGA_WEBHOOK_SECRET;
}

function restoreEnv() {
  restoreEnvValue("PLATEGA_BASE_URL", originalEnv.PLATEGA_BASE_URL);
  restoreEnvValue("PLATEGA_MERCHANT_ID", originalEnv.PLATEGA_MERCHANT_ID);
  restoreEnvValue("PLATEGA_SECRET", originalEnv.PLATEGA_SECRET);
  restoreEnvValue("PLATEGA_WEBHOOK_SECRET", originalEnv.PLATEGA_WEBHOOK_SECRET);
}

function restoreEnvValue(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
