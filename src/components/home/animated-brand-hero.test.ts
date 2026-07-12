import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(new URL("../../app/home.module.css", import.meta.url), "utf8");

test("uses an Apple-style system font stack for the hero wordmark", () => {
  assert.match(css, /font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display"/);
});

test("keeps the mobile brand scene compact instead of filling the viewport", () => {
  assert.match(css, /min-height: clamp\(170px, 52vw, 220px\)/);
  assert.doesNotMatch(css, /min-height: calc\(100svh - 4rem\)/);
});

test("renders platform statistics as one bordered panel", () => {
  assert.match(css, /\.stats \{[^}]*border: 1px solid rgba\(33,241,168/);
  assert.match(css, /\.stats \{[^}]*border-radius: 18px/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
});
