import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...segments: string[]) => readFileSync(path.join(root, ...segments), "utf8");

test("profile editor keeps its data and upload contracts while using the premium layout", () => {
  const form = read("src", "components", "dashboard", "profile-form.tsx");

  assert.match(form, /fetch\("\/api\/register",\s*\{\s*method: "PATCH"/);
  assert.match(form, /uploadFile\(optimized, type === "avatar" \? "avatars" : "banners"/);
  assert.match(form, /MAX_SELECTED_PROFILE_STATUSES/);
  assert.match(form, /className="profile-editor-shell/);
  assert.match(form, /profile-editor-hero/);
  assert.match(form, /profile-editor-status-card/);
  assert.match(form, /aria-pressed=\{selected\}/);
  assert.doesNotMatch(form, /profile-editor-status-description/);
  assert.doesNotMatch(form, /\{status\.description\}/);
});

test("profile editor exposes clear information, biography, status and action regions", () => {
  const form = read("src", "components", "dashboard", "profile-form.tsx");

  assert.match(form, /Основная информация/);
  assert.match(form, /Описание профиля/);
  assert.match(form, /Статусы профиля/);
  assert.match(form, /Сохранить изменения/);
});
