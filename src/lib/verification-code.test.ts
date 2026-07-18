import assert from "node:assert/strict";
import test from "node:test";

import { generateVerificationCode } from "./email";
import { generateTwoFactorCode } from "./two-factor";

test("security verification codes do not depend on Math.random", () => {
  const originalRandom = Math.random;
  Math.random = () => {
    throw new Error("Math.random must not generate security codes");
  };

  try {
    for (const generate of [generateVerificationCode, generateTwoFactorCode]) {
      const code = generate();
      assert.match(code, /^\d{6}$/);
      assert.ok(Number(code) >= 100000 && Number(code) <= 999999);
    }
  } finally {
    Math.random = originalRandom;
  }
});
