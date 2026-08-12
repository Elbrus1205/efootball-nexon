export const shopOrderStatuses = [
  "PENDING_PAYMENT",
  "PAID",
  "WAITING_SELLER",
  "ACCEPTED",
  "IN_PROGRESS",
  "SELLER_COMPLETED",
  "WAITING_BUYER_CONFIRMATION",
  "COMPLETED",
  "DISPUTE",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "EXPIRED",
] as const;

export type ShopOrderStatusValue = (typeof shopOrderStatuses)[number];
export type ShopOrderActor = "BUYER" | "SELLER" | "SUPPORT" | "ADMIN" | "SYSTEM";

type TransitionRule = { to: ShopOrderStatusValue; actors: readonly ShopOrderActor[] };

const rules: Record<ShopOrderStatusValue, readonly TransitionRule[]> = {
  PENDING_PAYMENT: [
    { to: "PAID", actors: ["SYSTEM", "ADMIN"] },
    { to: "CANCELLED", actors: ["BUYER", "SUPPORT", "ADMIN"] },
    { to: "EXPIRED", actors: ["SYSTEM", "ADMIN"] },
  ],
  PAID: [
    { to: "WAITING_SELLER", actors: ["SYSTEM", "ADMIN"] },
    { to: "IN_PROGRESS", actors: ["SYSTEM", "ADMIN"] },
    { to: "REFUND_PENDING", actors: ["SUPPORT", "ADMIN"] },
  ],
  WAITING_SELLER: [
    { to: "ACCEPTED", actors: ["SELLER", "ADMIN"] },
    { to: "CANCELLED", actors: ["SUPPORT", "ADMIN"] },
    { to: "REFUND_PENDING", actors: ["SUPPORT", "ADMIN"] },
    { to: "EXPIRED", actors: ["SYSTEM", "ADMIN"] },
  ],
  ACCEPTED: [
    { to: "IN_PROGRESS", actors: ["SELLER", "ADMIN"] },
    { to: "DISPUTE", actors: ["BUYER", "SELLER", "SUPPORT", "ADMIN"] },
    { to: "CANCELLED", actors: ["SUPPORT", "ADMIN"] },
  ],
  IN_PROGRESS: [
    { to: "SELLER_COMPLETED", actors: ["SELLER", "ADMIN"] },
    { to: "COMPLETED", actors: ["SYSTEM", "ADMIN"] },
    { to: "DISPUTE", actors: ["BUYER", "SELLER", "SUPPORT", "ADMIN"] },
  ],
  SELLER_COMPLETED: [
    { to: "WAITING_BUYER_CONFIRMATION", actors: ["SYSTEM", "ADMIN"] },
    { to: "DISPUTE", actors: ["BUYER", "SUPPORT", "ADMIN"] },
  ],
  WAITING_BUYER_CONFIRMATION: [
    { to: "COMPLETED", actors: ["BUYER", "SYSTEM", "ADMIN"] },
    { to: "DISPUTE", actors: ["BUYER", "SUPPORT", "ADMIN"] },
    { to: "REFUND_PENDING", actors: ["SUPPORT", "ADMIN"] },
  ],
  DISPUTE: [
    { to: "COMPLETED", actors: ["SUPPORT", "ADMIN"] },
    { to: "REFUND_PENDING", actors: ["SUPPORT", "ADMIN"] },
    { to: "IN_PROGRESS", actors: ["SUPPORT", "ADMIN"] },
    { to: "CANCELLED", actors: ["SUPPORT", "ADMIN"] },
  ],
  REFUND_PENDING: [{ to: "REFUNDED", actors: ["SYSTEM", "ADMIN"] }],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
  EXPIRED: [],
};

export class OrderTransitionError extends Error {
  code: "TRANSITION_NOT_ALLOWED" | "ACTOR_NOT_ALLOWED";

  constructor(code: OrderTransitionError["code"], message: string) {
    super(message);
    this.name = "OrderTransitionError";
    this.code = code;
  }
}

export function assertOrderTransition(input: {
  from: ShopOrderStatusValue;
  to: ShopOrderStatusValue;
  actor: ShopOrderActor;
}) {
  const transition = rules[input.from].find((rule) => rule.to === input.to);
  if (!transition) {
    throw new OrderTransitionError(
      "TRANSITION_NOT_ALLOWED",
      `Переход ${input.from} → ${input.to} недоступен.`,
    );
  }
  if (!transition.actors.includes(input.actor)) {
    throw new OrderTransitionError(
      "ACTOR_NOT_ALLOWED",
      `Роль ${input.actor} не может выполнить переход ${input.from} → ${input.to}.`,
    );
  }
}

export function getAllowedOrderTransitions(status: ShopOrderStatusValue, actor: ShopOrderActor) {
  return rules[status].filter((rule) => rule.actors.includes(actor)).map((rule) => rule.to);
}
