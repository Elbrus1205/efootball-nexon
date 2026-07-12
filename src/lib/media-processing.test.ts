import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isProcessableImageType, shouldReplaceAvatarWithTelegram } from "@/lib/media-processing";

describe("media processing helpers", () => {
  it("keeps a manually uploaded Supabase avatar when Telegram auth runs again", () => {
    assert.equal(shouldReplaceAvatarWithTelegram("https://example.supabase.co/storage/v1/object/public/public-media/avatars/avatar.webp"), false);
  });

  it("allows empty and old Telegram avatars to be replaced with cached storage URLs", () => {
    assert.equal(shouldReplaceAvatarWithTelegram(null), true);
    assert.equal(shouldReplaceAvatarWithTelegram("https://oauth.telegram.org/file/userpic/320/photo.jpg"), true);
    assert.equal(shouldReplaceAvatarWithTelegram("/api/telegram/image?url=https%3A%2F%2Foauth.telegram.org%2Ffile%2Fuserpic%2F320%2Fphoto.jpg"), true);
  });

  it("rejects svg and gif for profile image processing", () => {
    assert.equal(isProcessableImageType("image/jpeg"), true);
    assert.equal(isProcessableImageType("image/webp; charset=binary"), true);
    assert.equal(isProcessableImageType("image/svg+xml"), false);
    assert.equal(isProcessableImageType("image/gif"), false);
  });
});
