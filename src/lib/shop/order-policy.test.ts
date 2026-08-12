import assert from "node:assert/strict";
import test from "node:test";
import { getShopComplaintExpiresAt, isShopComplaintOpen } from "./order-policy";

test("complaint window lasts exactly 48 hours after payment", () => {
  const paidAt = new Date("2026-08-12T10:00:00.000Z");
  const expiresAt = getShopComplaintExpiresAt(paidAt);
  assert.equal(expiresAt.toISOString(), "2026-08-14T10:00:00.000Z");
  assert.equal(isShopComplaintOpen(paidAt, new Date("2026-08-14T09:59:59.999Z")), true);
  assert.equal(isShopComplaintOpen(paidAt, expiresAt), false);
});
