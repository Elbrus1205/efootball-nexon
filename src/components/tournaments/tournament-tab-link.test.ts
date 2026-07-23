import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(
  path.join(process.cwd(), "src", "components", "tournaments", "tournament-tab-link.tsx"),
  "utf8",
);

test("tournament tabs prefetch their routes without rendering a pending spinner", () => {
  assert.match(source, /prefetch=\{true\}/);
  assert.doesNotMatch(source, /useLinkStatus|animate-spin|TabPending/);
});
