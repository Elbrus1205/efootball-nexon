import { spawn, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");
const dockerServer = path.join(root, "server.js");

function copyMissingIfExists(from, to) {
  if (!existsSync(from)) {
    return;
  }

  mkdirSync(path.dirname(to), { recursive: true });
  copyMissingRecursive(from, to);
}

function copyMissingRecursive(from, to) {
  const stats = statSync(from);

  if (stats.isDirectory()) {
    if (!existsSync(to)) {
      mkdirSync(to, { recursive: true });
    }

    for (const entry of readdirSync(from)) {
      copyMissingRecursive(path.join(from, entry), path.join(to, entry));
    }

    return;
  }

  if (existsSync(to)) {
    return;
  }

  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(from, to);
}

function makeWritable(dir) {
  mkdirSync(dir, { recursive: true });

  try {
    chmodSync(dir, 0o777);
  } catch {
    // Best effort for hosts that do not expose POSIX chmod.
  }
}

const serverPath = existsSync(dockerServer) ? dockerServer : standaloneServer;
const runtimeDatabaseScript = path.join(root, "scripts", "ensure-runtime-database.mjs");
const telegramWebhookScript = path.join(root, "scripts", "ensure-telegram-webhook.mjs");

if (!existsSync(serverPath)) {
  console.error("Standalone server was not found. Run `npm run build` before `npm start`.");
  process.exit(1);
}

if (serverPath === standaloneServer) {
  copyMissingIfExists(path.join(root, "public"), path.join(standaloneDir, "public"));
  copyMissingIfExists(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
}

for (const cacheRoot of [
  path.join(root, ".next", "cache"),
  path.join(standaloneDir, ".next", "cache"),
  path.join(root, ".next", "cache", "images"),
  path.join(root, ".next", "cache", "fetch-cache"),
  path.join(standaloneDir, ".next", "cache", "images"),
  path.join(standaloneDir, ".next", "cache", "fetch-cache"),
]) {
  makeWritable(cacheRoot);
}

if (existsSync(runtimeDatabaseScript)) {
  const result = spawnSync(process.execPath, [runtimeDatabaseScript], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "production",
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (existsSync(telegramWebhookScript)) {
  const result = spawnSync(process.execPath, [telegramWebhookScript], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "production",
    },
  });

  if (result.status !== 0) {
    console.warn("Telegram webhook check failed; application startup will continue.");
  }
}

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "production",
    HOSTNAME: process.env.NEXT_HOSTNAME || "0.0.0.0",
  },
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (!child.killed) {
    child.kill(signal);
  }

  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.exit(signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1);
    return;
  }

  process.exit(code ?? 0);
});
