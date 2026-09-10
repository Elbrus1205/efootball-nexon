import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ignoredDirectories = new Set([
  ".git", ".next", "node_modules", "out", "build", "dist", "coverage",
  ".cache", ".vercel", "android-twa", "android-output", "db-backup", "db-backups", "db_backups",
]);
const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".scss",
  ".html", ".svg", ".xml", ".md", ".mdx", ".txt", ".sql", ".prisma",
  ".yaml", ".yml", ".toml", ".sh", ".ps1", ".bat", ".cmd", ".csv",
]);
const textNames = new Set([
  "Dockerfile", "Procfile", ".env.example", ".gitignore", ".gitattributes",
  ".dockerignore", ".vercelignore", ".editorconfig", ".npmrc",
]);

export function checkTextEncoding(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return "Invalid UTF-8 bytes";
  }
  if (text.includes("\0")) return "Unexpected NUL bytes (possibly UTF-16)";
  if (text.includes("\uFFFD")) return "Replacement character U+FFFD: text has already been corrupted";
  if (/(?:[\u0420\u0421][\u0080-\u00ff\u0400-\u04ff\u2000-\u2122]){3,}/u.test(text)) {
    return "Mojibake: UTF-8 Cyrillic was decoded as Windows-1251";
  }
  return null;
}

export function checkProjectEncoding(root) {
  const failures = [];
  let checked = 0;
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) visit(filename);
      } else if (entry.isFile() && (textExtensions.has(path.extname(entry.name).toLowerCase()) || textNames.has(entry.name))) {
        checked += 1;
        const error = checkTextEncoding(readFileSync(filename));
        if (error) failures.push({ filename: path.relative(root, filename), error });
      }
    }
  }
  visit(root);
  return { checked, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkProjectEncoding(process.cwd());
  for (const failure of result.failures) console.error(`${failure.filename}: ${failure.error}`);
  console.log(`Encoding check: ${result.checked} text files, ${result.failures.length} errors.`);
  if (result.failures.length) process.exitCode = 1;
}
