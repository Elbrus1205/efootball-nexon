export type PaymentWebhookStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "REFUNDED";

export type VerifiedPaymentWebhook = {
  eventId: string;
  externalPaymentId: string;
  status: PaymentWebhookStatus;
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  raw?: unknown;
};

export type PaymentProvider = {
  name: string;
  createPayment(input: {
    orderId: string;
    orderNumber: string;
    userId: string;
    amountMinor: number;
    currency: string;
    returnUrl: string;
    description: string;
    idempotencyKey: string;
  }): Promise<{ externalPaymentId: string; checkoutUrl: string; expiresAt?: Date | null }>;
  verifyWebhook(input: { headers: Headers; body: string }): Promise<VerifiedPaymentWebhook | null>;
  refundPayment(input: {
    externalPaymentId: string;
    amountMinor: number;
    idempotencyKey: string;
    reason: string;
  }): Promise<{ externalRefundId: string; status: "PENDING" | "SUCCEEDED" }>;
};

export type StoredWebhookPayment = {
  id: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  status: string;
};

export type PaymentWebhookStore = {
  claimEvent(eventId: string, event?: VerifiedPaymentWebhook): Promise<boolean>;
  getPaymentByExternalId(externalPaymentId: string): Promise<StoredWebhookPayment | null>;
  confirmPayment(input: {
    paymentId: string;
    orderId: string;
    eventId: string;
    occurredAt: Date;
  }): Promise<void>;
  cancelPayment(input: {
    paymentId: string;
    orderId: string;
    eventId: string;
    status: "FAILED" | "CANCELLED";
    occurredAt: Date;
  }): Promise<void>;
  failEvent(eventId: string, reason: string): Promise<void>;
};

export async function handlePaymentWebhook(input: {
  provider: PaymentProvider;
  store: PaymentWebhookStore;
  headers: Headers;
  body: string;
}) {
  const event = await input.provider.verifyWebhook({ headers: input.headers, body: input.body });
  if (!event) return { accepted: true as const, ignored: true as const, duplicate: false as const };
  const claimed = await input.store.claimEvent(event.eventId, event);
  if (!claimed) return { accepted: true as const, duplicate: true as const };

  const payment = await input.store.getPaymentByExternalId(event.externalPaymentId);
  if (!payment) {
    await input.store.failEvent(event.eventId, "Платёж не найден.");
    throw new Error("Платёж из webhook не найден.");
  }

  if (payment.amountMinor !== event.amountMinor || payment.currency !== event.currency) {
    await input.store.failEvent(event.eventId, "Не совпадает сумма платежа или валюта.");
    throw new Error("Не совпадает сумма платежа или валюта.");
  }

  if (event.status === "SUCCEEDED") {
    await input.store.confirmPayment({
      paymentId: payment.id,
      orderId: payment.orderId,
      eventId: event.eventId,
      occurredAt: event.occurredAt,
    });
  } else if (event.status === "FAILED" || event.status === "CANCELLED") {
    await input.store.cancelPayment({
      paymentId: payment.id,
      orderId: payment.orderId,
      eventId: event.eventId,
      status: event.status,
      occurredAt: event.occurredAt,
    });
  }

  return { accepted: true as const, duplicate: false as const, orderId: payment.orderId, status: event.status };
}
