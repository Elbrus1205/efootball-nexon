import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/home.module.css", import.meta.url), "utf8");

test("home uses a new editorial product showcase", () => {
  assert.match(page, /EFOOTBALL[\s\S]*NEXON/);
  assert.match(page, /Турниры\.<br \/><em>Матчи\. Победы\.<\/em>/);
  assert.match(page, /HomeCarousel/);
  assert.match(page, /TopPlayers/);
  assert.match(css, /\.productStage\s*\{/);
  assert.match(css, /\.processSection\s*\{/);
});

test("home keeps reduced motion and mobile carousel behavior", () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /scroll-snap-type: x mandatory/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
