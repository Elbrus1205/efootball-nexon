import assert from "node:assert/strict";
import test from "node:test";

import { checkoutShopOrderSchema, isForbiddenShopCredentialField } from "./validators";

test("магазин запрещает поля для учётных секретов", () => {
  assert.equal(isForbiddenShopCredentialField({ key: "password", label: "Пароль" }), true);
  assert.equal(isForbiddenShopCredentialField({ key: "otp", label: "Код из приложения" }), true);
  assert.equal(isForbiddenShopCredentialField({ key: "gameId", label: "Игровой ID" }), false);
});

test("checkout принимает только подтверждённую актуальную форму", () => {
  const valid = checkoutShopOrderSchema.safeParse({
    variantId: "variant-1",
    quantity: 1,
    fields: { gameId: "123456789" },
    termsAccepted: true,
    termsVersion: "shop-draft-1",
  });
  assert.equal(valid.success, true);

  const missingConsent = checkoutShopOrderSchema.safeParse({
    variantId: "variant-1",
    quantity: 1,
    fields: {},
    termsAccepted: false,
    termsVersion: "shop-draft-1",
  });
  assert.equal(missingConsent.success, false);
});
