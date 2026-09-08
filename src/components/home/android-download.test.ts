import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Android download points to the real published APK", () => {
  const links = readFileSync(path.join(root, "src", "lib", "home-links.ts"), "utf8");
  const button = readFileSync(path.join(root, "src", "components", "home", "android-download.tsx"), "utf8");
  const apk = path.join(root, "public", "downloads", "efootball-nexon.apk");
  assert.ok(existsSync(apk));
  assert.ok(statSync(apk).size > 100_000);
  assert.match(links, /downloads\/efootball-nexon\.apk/);
  assert.match(button, /download="efootball-nexon\.apk"/);
});
