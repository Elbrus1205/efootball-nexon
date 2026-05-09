import { spawn } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");
const dockerServer = path.join(root, "server.js");

function copyIfExists(from, to) {
  if (!existsSync(from) || existsSync(to)) {
    return;
  }

  mkdirSync(path.dirname(to), { recursive: true });
  copyRecursive(from, to);
}

function copyRecursive(from, to) {
  const stats = statSync(from);

  if (stats.isDirectory()) {
    mkdirSync(to, { recursive: true });

    for (const entry of readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }

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

if (!existsSync(serverPath)) {
  console.error("Standalone server was not found. Run `npm run build` before `npm start`.");
  process.exit(1);
}

if (serverPath === standaloneServer) {
  copyIfExists(path.join(root, "public"), path.join(standaloneDir, "public"));
  copyIfExists(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
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

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || "production",
    HOSTNAME: process.env.NEXT_HOSTNAME || "0.0.0.0",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
