import assert from "node:assert/strict";
import test from "node:test";

import { getRequiredUploadPermission } from "./upload-policy";

test("personal media folders do not require an administrative permission", () => {
  assert.equal(getRequiredUploadPermission("avatars"), null);
  assert.equal(getRequiredUploadPermission("banners"), null);
  assert.equal(getRequiredUploadPermission("lineups"), null);
});

test("managed content folders require their matching server-side permission", () => {
  assert.equal(getRequiredUploadPermission("tournaments"), "tournaments.createEdit");
  assert.equal(getRequiredUploadPermission("divisions"), "divisions.manage");
  assert.equal(getRequiredUploadPermission("faq"), "content.manage");
  assert.equal(getRequiredUploadPermission("shop-products"), "shop.manage");
});
