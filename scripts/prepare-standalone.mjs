import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");

function copyIntoIfExists(from, to) {
  if (!existsSync(from)) {
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
    // Windows and some build systems can ignore POSIX chmod.
  }
}

if (existsSync(standaloneDir)) {
  copyIntoIfExists(path.join(root, "public"), path.join(standaloneDir, "public"));
  copyIntoIfExists(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));
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
