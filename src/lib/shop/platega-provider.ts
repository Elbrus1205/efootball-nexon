import { timingSafeEqual } from "node:crypto";

import { ShopError } from "@/lib/shop/errors";
import type { PaymentProvider, PaymentWebhookStatus, VerifiedPaymentWebhook } from "@/lib/shop/payments";

const DEFAULT_PLATEGA_BASE_URL = "https://app.platega.io/";
const CHECKOUT_FIELDS = ["url", "redirect", "payformUrl", "payformSuccessUrl"] as const;

type PlategaConfig = {
  merchantId: string;
  secret: string;
  webhookSecret: string;
  baseUrl: string;
};

type PlategaReadiness = {
  configured: boolean;
  missing: string[];
  reason?: string;
};

export function getPlategaReadiness(): PlategaReadiness {
  const missing: string[] = [];
  if (!readEnv("PLATEGA_MERCHANT_ID")) missing.push("PLATEGA_MERCHANT_ID");
  if (!readEnv("PLATEGA_SECRET")) missing.push("PLATEGA_SECRET");

  return missing.length === 0
    ? { configured: true, missing }
    : {
      configured: false,
      missing,
      reason: `Missing Platega variables: ${missing.join(", ")}.`,
    };
}

export function createPlategaProvider(): PaymentProvider {
  return {
    name: "platega",
    async createPayment(input) {
      const config = readConfig();
      const response = await plategaFetch(config, "transaction/process", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: 2,
          paymentDetails: {
            amount: minorToMajor(input.amountMinor),
            currency: input.currency,
          },
          description: input.description,
          return: input.returnUrl,
          failedUrl: appendSearchParam(input.returnUrl, "payment", "failed"),
          payload: input.orderId,
          metadata: {
            userId: input.orderId,
            orderNumber: input.orderNumber,
          },
        }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new ShopError(
          "PLATEGA_CREATE_PAYMENT_FAILED",
          `Platega did not create a payment link: ${extractErrorMessage(data) ?? response.statusText}.`,
          502,
        );
      }

      const payload = ensureRecord(data, "Invalid Platega response while creating a payment.");
      const externalPaymentId = readString(payload, ["transactionId", "id"]);
      const checkoutUrl = readString(payload, CHECKOUT_FIELDS);
      if (!externalPaymentId || !checkoutUrl) {
        throw new ShopError("PLATEGA_CREATE_PAYMENT_INVALID_RESPONSE", "Platega response did not include payment ID or checkout URL.", 502);
      }

      return {
        externalPaymentId,
        checkoutUrl,
        expiresAt: parseExpiresIn(readString(payload, ["expiresIn"])),
      };
    },
    async verifyWebhook(input) {
      const config = readConfig();
      assertWebhookHeader(input.headers, "x-merchantid", config.merchantId, "PLATEGA_WEBHOOK_MERCHANT_MISMATCH");
      assertWebhookHeader(input.headers, "x-secret", config.webhookSecret, "PLATEGA_WEBHOOK_SECRET_MISMATCH");

      const payload = ensureRecord(parseWebhookBody(input.body), "Invalid Platega webhook.");
      const externalPaymentId = readString(payload, ["id", "transactionId"]);
      const status = readString(payload, ["status"]);
      const currency = readString(payload, ["currency"]);
      const amount = payload.amount;
      if (!externalPaymentId || !status || !currency || amount === undefined) {
        throw new ShopError("PLATEGA_WEBHOOK_INVALID", "Platega webhook does not include ID, status, amount, or currency.", 400);
      }

      const amountMinor = majorToMinor(amount);
      const normalizedStatus = mapWebhookStatus(status);
      return {
        eventId: `${externalPaymentId}:${status}:${amountMinor}:${currency}`,
        externalPaymentId,
        status: normalizedStatus,
        amountMinor,
        currency,
        occurredAt: new Date(),
        raw: payload,
      } satisfies VerifiedPaymentWebhook;
    },
    async refundPayment(input) {
      const config = readConfig();
      if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
        throw new ShopError("PLATEGA_REFUND_AMOUNT_INVALID", "Invalid refund amount.");
      }

      const response = await plategaFetch(config, `transaction/${encodeURIComponent(input.externalPaymentId)}/cancel`, {
        method: "POST",
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new ShopError(
          "PLATEGA_REFUND_FAILED",
          `Platega did not accept the refund: ${extractErrorMessage(data) ?? response.statusText}.`,
          502,
        );
      }

      const payload = ensureRecord(data, "Invalid Platega response while refunding a payment.");
      const externalRefundId = readString(payload, ["transactionId", "id"]) ?? `${input.externalPaymentId}:cancel`;
      const accepted = payload.accepted === true || payload.manualControlRequired === true;
      if (!accepted) {
        throw new ShopError("PLATEGA_REFUND_REJECTED", extractErrorMessage(payload) ?? "Platega rejected the refund.", 409);
      }

      return {
        externalRefundId,
        status: payload.manualControlRequired === true ? "PENDING" : "SUCCEEDED",
      };
    },
  };
}

function readConfig(): PlategaConfig {
  const merchantId = readEnv("PLATEGA_MERCHANT_ID");
  const secret = readEnv("PLATEGA_SECRET");
  if (!merchantId || !secret) {
    throw new ShopError(
      "PLATEGA_NOT_CONFIGURED",
      "Platega payment is temporarily unavailable: PLATEGA_MERCHANT_ID or PLATEGA_SECRET is missing.",
      503,
    );
  }

  return {
    merchantId,
    secret,
    webhookSecret: readEnv("PLATEGA_WEBHOOK_SECRET") ?? secret,
    baseUrl: normalizeBaseUrl(readEnv("PLATEGA_BASE_URL") ?? DEFAULT_PLATEGA_BASE_URL),
  };
}

async function plategaFetch(config: PlategaConfig, path: string, init: RequestInit) {
  return fetch(new URL(path, config.baseUrl), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-MerchantId": config.merchantId,
      "X-Secret": config.secret,
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
    throw new ShopError("PLATEGA_WEBHOOK_BAD_JSON", "Platega webhook contains invalid JSON.", 400);
  }
}

function ensureRecord(value: unknown, message: string): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new ShopError("PLATEGA_INVALID_RESPONSE", message, 502);
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
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

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function minorToMajor(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new ShopError("PLATEGA_AMOUNT_INVALID", "Invalid payment amount.");
  }
  return Number((amountMinor / 100).toFixed(2));
}

function majorToMinor(value: unknown) {
  const normalized = String(value).replace(",", ".").trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw new ShopError("PLATEGA_WEBHOOK_AMOUNT_INVALID", "Platega webhook contains an invalid amount.", 400);

  const major = Number(match[1]);
  const minor = Number((match[2] ?? "").padEnd(2, "0"));
  const amountMinor = major * 100 + minor;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new ShopError("PLATEGA_WEBHOOK_AMOUNT_INVALID", "Platega webhook contains an invalid amount.", 400);
  }
  return amountMinor;
}

function mapWebhookStatus(status: string): PaymentWebhookStatus {
  switch (status.trim().toUpperCase()) {
    case "CONFIRMED":
    case "SUCCESS":
    case "SUCCEEDED":
      return "SUCCEEDED";
    case "PENDING":
    case "PROCESSING":
      return "PENDING";
    case "CANCELED":
    case "CANCELLED":
      return "CANCELLED";
    case "CHARGEBACKED":
    case "REFUNDED":
      return "REFUNDED";
    default:
      return "FAILED";
  }
}

function parseExpiresIn(value?: string) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  const durationMs = (Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds)) * 1000;
  return durationMs > 0 ? new Date(Date.now() + durationMs) : null;
}

function appendSearchParam(rawUrl: string, key: string, value: string) {
  const url = new URL(rawUrl);
  url.searchParams.set(key, value);
  return url.toString();
}

function assertWebhookHeader(headers: Headers, name: string, expected: string, code: string) {
  const actual = headers.get(name)?.trim();
  if (!actual || !constantTimeEqual(actual, expected)) {
    throw new ShopError(code, "Platega webhook signature check failed.", 401);
  }
}

function constantTimeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
