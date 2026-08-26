import { timingSafeEqual } from "node:crypto";

import { ShopError } from "@/lib/shop/errors";
import type { PaymentProvider, PaymentWebhookStatus, VerifiedPaymentWebhook } from "@/lib/shop/payments";

const DEFAULT_CASHERA_BASE_URL = "https://api.cashera.cash/api/v1/";
const CASHERA_PAYMENT_METHODS = ["sbp", "card", "mastercard", "crypto", "cryptobot"] as const;

type CasheraPaymentMethod = (typeof CASHERA_PAYMENT_METHODS)[number];

type CasheraConfig = {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  paymentMethod: CasheraPaymentMethod;
};

type CasheraReadiness = {
  configured: boolean;
  missing: string[];
  reason?: string;
};

export function getCasheraReadiness(): CasheraReadiness {
  const missing: string[] = [];
  if (!readEnv("CASHERA_API_KEY")) missing.push("CASHERA_API_KEY");
  if (!readEnv("CASHERA_API_SECRET")) missing.push("CASHERA_API_SECRET");

  const paymentMethod = readEnv("CASHERA_PAYMENT_METHOD") ?? "sbp";
  if (!isPaymentMethod(paymentMethod)) {
    return {
      configured: false,
      missing,
      reason: `Invalid CASHERA_PAYMENT_METHOD: ${paymentMethod}.`,
    };
  }

  return missing.length === 0
    ? { configured: true, missing }
    : {
      configured: false,
      missing,
      reason: `Missing Cashera variables: ${missing.join(", ")}.`,
    };
}

export function createCasheraProvider(): PaymentProvider {
  return {
    name: "cashera",
    async createPayment(input) {
      const config = readConfig();
      assertPaymentInput(input.amountMinor, input.currency);

      const successUrl = new URL(input.returnUrl);
      successUrl.searchParams.set("payment", "success");
      const failUrl = new URL(input.returnUrl);
      failUrl.searchParams.set("payment", "failed");
      const callbackUrl = new URL("/api/shop/payments/webhook/cashera", input.returnUrl);

      const response = await casheraFetch(config, "integration/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: input.amountMinor,
          currency: input.currency,
          payment_method: config.paymentMethod,
          external_id: input.idempotencyKey.slice(0, 255),
          description: input.description.slice(0, 255),
          metadata: {
            order_id: input.orderId,
            order_number: input.orderNumber,
            user_id: input.userId,
          },
          callback_url: callbackUrl.toString(),
          success_url: successUrl.toString(),
          fail_url: failUrl.toString(),
        }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new ShopError(
          "CASHERA_CREATE_PAYMENT_FAILED",
          `Cashera did not create a payment link: ${extractErrorMessage(data) ?? response.statusText}.`,
          502,
        );
      }

      const payload = ensureRecord(data, "Invalid Cashera response while creating a payment.");
      const externalPaymentId = readString(payload, ["uuid"]);
      const rawCheckoutUrl = readString(payload, ["payment_url"]);
      if (!externalPaymentId || !rawCheckoutUrl) {
        throw new ShopError(
          "CASHERA_CREATE_PAYMENT_INVALID_RESPONSE",
          "Cashera response did not include uuid or payment_url.",
          502,
        );
      }

      return {
        externalPaymentId,
        checkoutUrl: normalizeCheckoutUrl(rawCheckoutUrl),
        expiresAt: parseDate(readString(payload, ["expires_at"])),
      };
    },
    async verifyWebhook(input) {
      const config = readConfig();
      assertWebhookHeader(input.headers, "x-api-key", config.apiKey, "CASHERA_WEBHOOK_API_KEY_MISMATCH");
      assertWebhookHeader(input.headers, "x-secret", config.apiSecret, "CASHERA_WEBHOOK_SECRET_MISMATCH");

      const payload = ensureRecord(parseWebhookBody(input.body), "Invalid Cashera webhook.");
      const eventName = readString(payload, ["event"]);
      if (eventName !== "transaction.status_updated") return null;

      const transaction = ensureRecord(payload.transaction, "Cashera webhook does not include a transaction.");
      const externalPaymentId = readString(transaction, ["uuid"]);
      const status = readString(transaction, ["status"]);
      const currency = readString(transaction, ["currency"]);
      const amount = transaction.amount;
      if (!externalPaymentId || !status || !currency || !Number.isSafeInteger(amount) || Number(amount) <= 0) {
        throw new ShopError(
          "CASHERA_WEBHOOK_INVALID",
          "Cashera webhook does not include a valid uuid, status, amount, or currency.",
          400,
        );
      }

      return {
        eventId: `${externalPaymentId}:${status}`,
        externalPaymentId,
        status: mapWebhookStatus(status),
        amountMinor: Number(amount),
        currency,
        occurredAt: parseDate(readString(transaction, ["paid_at", "updated_at"])) ?? new Date(),
        raw: payload,
      } satisfies VerifiedPaymentWebhook;
    },
    async refundPayment() {
      throw new ShopError(
        "CASHERA_REFUND_NOT_SUPPORTED",
        "Automatic refunds are not available in the Cashera integration. Process the refund in Cashera and record it in the shop admin panel.",
        501,
      );
    },
  };
}

function readConfig(): CasheraConfig {
  const apiKey = readEnv("CASHERA_API_KEY");
  const apiSecret = readEnv("CASHERA_API_SECRET");
  const paymentMethod = readEnv("CASHERA_PAYMENT_METHOD") ?? "sbp";
  if (!apiKey || !apiSecret) {
    throw new ShopError(
      "CASHERA_NOT_CONFIGURED",
      "Cashera payment is temporarily unavailable: CASHERA_API_KEY or CASHERA_API_SECRET is missing.",
      503,
    );
  }
  if (!isPaymentMethod(paymentMethod)) {
    throw new ShopError("CASHERA_PAYMENT_METHOD_INVALID", "Invalid Cashera payment method configuration.", 500);
  }

  return {
    apiKey,
    apiSecret,
    paymentMethod,
    baseUrl: normalizeBaseUrl(readEnv("CASHERA_BASE_URL") ?? DEFAULT_CASHERA_BASE_URL),
  };
}

async function casheraFetch(config: CasheraConfig, path: string, init: RequestInit) {
  return fetch(new URL(path, config.baseUrl), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": config.apiKey,
      ...init.headers,
    },
  });
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function parseWebhookBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ShopError("CASHERA_WEBHOOK_BAD_JSON", "Cashera webhook contains invalid JSON.", 400);
  }
}

function ensureRecord(value: unknown, message: string): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new ShopError("CASHERA_INVALID_RESPONSE", message, 502);
}

function readString(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function extractErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return readString(value as Record<string, unknown>, ["message", "error", "detail", "title"]);
}

function assertPaymentInput(amountMinor: number, currency: string) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new ShopError("CASHERA_AMOUNT_INVALID", "Invalid payment amount.");
  }
  if (currency !== "RUB") {
    throw new ShopError("CASHERA_CURRENCY_INVALID", "Cashera accepts shop payments only in RUB.");
  }
}

function mapWebhookStatus(status: string): PaymentWebhookStatus {
  switch (status.trim().toLowerCase()) {
    case "paid":
      return "SUCCEEDED";
    case "pending":
    case "processing":
      return "PENDING";
    case "expired":
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "refunded":
    case "chargeback":
      return "REFUNDED";
    default:
      return "FAILED";
  }
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCheckoutUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isPaymentMethod(value: string): value is CasheraPaymentMethod {
  return CASHERA_PAYMENT_METHODS.some((method) => method === value);
}

function assertWebhookHeader(headers: Headers, name: string, expected: string, code: string) {
  const actual = headers.get(name)?.trim();
  if (!actual || !constantTimeEqual(actual, expected)) {
    throw new ShopError(code, "Cashera webhook authentication failed.", 401);
  }
}

function constantTimeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
