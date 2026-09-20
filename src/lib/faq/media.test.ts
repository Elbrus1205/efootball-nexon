import assert from "node:assert/strict";
import test from "node:test";
import { getFaqVideoEmbedUrl, isSafeFaqUrl } from "./media";
import { normalizeFaqBlocks } from "./content";

test("FAQ rejects executable, protocol-relative and malformed media URLs", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,test", "//evil.test/x", "/\\evil.test", "https://user:pass@site.test", "java\nscript:alert(1)", "not a url"]) {
    assert.equal(isSafeFaqUrl(url), false, url);
    assert.deepEqual(normalizeFaqBlocks([{ type: "link", title: "Link", url }]), []);
  }
  for (const url of ["https://cdn.test/a.png", "/uploads/photo.webp", "http://localhost:3000/test.mp4"]) {
    assert.equal(isSafeFaqUrl(url), true);
  }
});

test("FAQ embeds only canonical YouTube and RuTube players", () => {
  for (const url of ["https://youtu.be/dQw4w9WgXcQ?si=test", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ"]) {
    assert.equal(getFaqVideoEmbedUrl(url), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  }
  assert.equal(getFaqVideoEmbedUrl("https://rutube.ru/video/0123456789abcdef0123456789abcdef/"), "https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef");
  for (const url of ["https://youtube.com.evil.test/watch?v=dQw4w9WgXc", "https://youtube.com/watch?v=invalid", "/uploads/video.mp4", "https://cdn.test/video.mp4"]) {
    assert.equal(getFaqVideoEmbedUrl(url), null);
  }
});
