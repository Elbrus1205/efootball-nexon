import assert from "node:assert/strict";
import test from "node:test";
import { getTrustedClientAddress } from "./client-address";

test("trusted proxy address wins over spoofable forwarded entries", () => {
  const headers = new Headers({
    "x-real-ip": "203.0.113.9",
    "x-forwarded-for": "198.51.100.8, 203.0.113.9",
  });
  assert.equal(getTrustedClientAddress(headers), "203.0.113.9");
});

test("the nearest forwarded address is used without x-real-ip", () => {
  const headers = new Headers({ "x-forwarded-for": "198.51.100.8, 203.0.113.9" });
  assert.equal(getTrustedClientAddress(headers), "203.0.113.9");
});
