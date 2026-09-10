import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkProjectEncoding, checkTextEncoding } from "./check-encoding.mjs";

test("accepts UTF-8 Cyrillic, ASCII and an optional UTF-8 BOM", () => {
  for (const text of ["plain text", "Выбранный игрок", "\uFEFFРегламент"]) {
    assert.equal(checkTextEncoding(Buffer.from(text, "utf8")), null);
  }
});

test("rejects Windows-1251 embedded in an otherwise UTF-8 component", () => {
  const bytes = Buffer.concat([
    Buffer.from('<div>Игрок</div><span>'),
    Buffer.from([0xc2, 0xfb, 0xe1, 0xf0, 0xe0, 0xed]),
    Buffer.from('</span>'),
  ]);
  assert.match(checkTextEncoding(bytes), /Invalid UTF-8/);
});

test("rejects Cyrillic mojibake saved as valid UTF-8", () => {
  const corrupted = new TextDecoder("windows-1251").decode(Buffer.from("Профиль"));
  assert.match(checkTextEncoding(Buffer.from(corrupted)), /Mojibake/);
});

test("rejects UTF-16, truncated sequences and replacement characters", () => {
  assert.ok(checkTextEncoding(Buffer.from("source", "utf16le")));
  assert.ok(checkTextEncoding(Buffer.from([0xd0])));
  assert.match(checkTextEncoding(Buffer.from("text\uFFFD")), /U\+FFFD/);
});

test("scans project text without Git and excludes binaries and build output", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "nexon-encoding-"));
  try {
    mkdirSync(path.join(root, "src"));
    mkdirSync(path.join(root, ".next"));
    writeFileSync(path.join(root, "src", "broken.tsx"), Buffer.from([0xc2, 0xfb]));
    writeFileSync(path.join(root, "src", "valid.ts"), 'export const title = "Регламент";');
    writeFileSync(path.join(root, ".next", "ignored.js"), Buffer.from([0xff]));
    writeFileSync(path.join(root, "image.png"), Buffer.from([0xff]));
    const result = checkProjectEncoding(root);
    assert.equal(result.checked, 2);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].filename, path.join("src", "broken.tsx"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
