import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");

test("installed Android app gets a branded startup screen until essential assets are ready", () => {
  const provider = read("src", "components", "providers", "app-launch-splash.tsx");
  const styles = read("src", "components", "providers", "app-launch-splash.module.css");
  const appProviders = read("src", "components", "providers", "app-providers.tsx");

  assert.match(provider, /document\.fonts\?\.ready/);
  assert.match(provider, /display-mode: standalone/);
  assert.match(provider, /efootball-nexon-installed-app/);
  assert.match(provider, /aria-label="Загрузка eFootball Nexon"/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(appProviders, /<AppLaunchSplash \/>/);
});

test("manifest describes a stable standalone Android identity", () => {
  const manifest = JSON.parse(read("public", "manifest.webmanifest")) as {
    id?: string;
    display?: string;
    icons?: Array<{ src: string; purpose?: string }>;
  };

  assert.equal(manifest.id, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons?.some((icon) => icon.src === "/icons/efootball-nexon-app-512-v2.png" && icon.purpose === "any"));
  assert.ok(manifest.icons?.some((icon) => icon.src === "/icons/efootball-nexon-maskable-512-v2.png" && icon.purpose === "maskable"));
});

test("maskable launcher icon is full-bleed and opaque", async () => {
  const metadata = await sharp(path.join(root, "public", "icons", "efootball-nexon-maskable-512-v2.png")).metadata();
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.hasAlpha, false);
});

test("site and installed app use the new cache-busted icon set", () => {
  const layout = read("src", "app", "layout.tsx");
  const provider = read("src", "components", "providers", "app-launch-splash.tsx");

  assert.equal(existsSync(path.join(root, "src", "app", "favicon.ico")), false, "legacy favicon must not override the new site icon");
  assert.match(layout, /efootball-nexon-app-192-v2\.png/);
  assert.match(layout, /efootball-nexon-app-512-v2\.png/);
  assert.match(provider, /efootball-nexon-maskable-512-v2\.png/);
});

test("full-screen launch animation belongs only to the installed app", () => {
  const styles = read("src", "components", "providers", "app-launch-splash.module.css");
  const routeLoading = read("src", "app", "loading.tsx");

  assert.doesNotMatch(routeLoading, /app-launch-splash|routeSplash|<Image/);
  assert.match(routeLoading, /return null/);
  assert.match(styles, /\.splash\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /@media\s*\(display-mode:\s*standalone\)[\s\S]*?\.splash\s*\{\s*display:\s*grid/);
  assert.match(styles, /background-color:\s*#080d16/);
});

test("home page offers the trusted browser install flow instead of a raw APK download", () => {
  const installer = read("src", "components", "home", "install-app-button.tsx");
  const registrar = read("src", "components", "providers", "push-notification-registrar.tsx");
  assert.match(installer, /beforeinstallprompt/);
  assert.match(installer, /installPrompt\.prompt\(\)/);
  assert.match(installer, /installPrompt\.userChoice/);
  assert.match(installer, /appinstalled/);
  assert.doesNotMatch(installer, /\.apk/i);
  assert.ok(
    registrar.indexOf('serviceWorker.register("/sw.js"') < registrar.indexOf('status !== "authenticated"'),
    "service worker must be registered before authentication is required",
  );
});
