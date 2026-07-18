import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedCoverSource } from "./image-optimization";

test("cover proxy accepts local and configured Supabase storage only", () => {
  const supabaseUrl = "https://project.supabase.co";
  assert.equal(isAllowedCoverSource("/images/cover.webp", supabaseUrl), true);
  assert.equal(isAllowedCoverSource("https://project.supabase.co/storage/v1/object/public/media/cover.webp", supabaseUrl), true);
  assert.equal(isAllowedCoverSource("https://app.example/api/tournaments/loop/cover", supabaseUrl), false);
  assert.equal(isAllowedCoverSource("https://attacker.example/internal", supabaseUrl), false);
  assert.equal(isAllowedCoverSource("http://169.254.169.254/latest/meta-data", supabaseUrl), false);
});
