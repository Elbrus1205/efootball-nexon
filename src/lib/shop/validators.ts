import { z } from "zod";

const forbiddenCredentialPattern = /(?:password|passcode|парол|otp|one.?time|однораз|2fa|token|токен|secret|секрет|backup.?code|резервн.*код|session|сесси)/i;

export function isForbiddenShopCredentialField(input: { key: string; label: string }) {
  return forbiddenCredentialPattern.test(`${input.key} ${input.label}`);
}

export const checkoutShopOrderSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
  promoCode: z.string().trim().min(2).max(40).optional(),
  fields: z.record(z.string().min(1).max(80), z.string().trim().max(2_000)),
  termsAccepted: z.literal(true),
  termsVersion: z.string().min(1).max(80),
});

export const shopOrderActionSchema = z.object({
  action: z.enum(["ACCEPT", "START", "SELLER_COMPLETE", "BUYER_CONFIRM", "CANCEL", "OPEN_DISPUTE"]),
  comment: z.string().trim().max(2_000).optional(),
  reason: z.string().trim().max(120).optional(),
  desiredResolution: z.string().trim().max(500).optional(),
});

export const shopReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(3).max(2_000),
  tags: z.array(z.enum(["быстро", "надёжно", "всё получено", "хорошая поддержка", "долгое выполнение", "возникли проблемы"])).max(6),
  mediaUrls: z.array(z.string().url().max(2_048)).max(5).default([]),
});

export const shopCatalogQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  type: z.enum(["IN_GAME", "PROMOTIONAL"]).optional(),
  minPriceMinor: z.coerce.number().int().min(0).optional(),
  maxPriceMinor: z.coerce.number().int().min(0).optional(),
  availableOnly: z.coerce.boolean().optional(),
  popularOnly: z.coerce.boolean().optional(),
  discountedOnly: z.coerce.boolean().optional(),
  sort: z.enum(["popular", "new", "price-asc", "price-desc", "discount"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(48).optional(),
});
