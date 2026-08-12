export const SHOP_COMPLAINT_WINDOW_MS = 48 * 60 * 60_000;

export function getShopComplaintExpiresAt(paidAt: Date) {
  return new Date(paidAt.getTime() + SHOP_COMPLAINT_WINDOW_MS);
}

export function isShopComplaintOpen(paidAt: Date | null, now = new Date()) {
  return Boolean(paidAt && getShopComplaintExpiresAt(paidAt) > now);
}
