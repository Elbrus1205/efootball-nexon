import assert from "node:assert/strict";
import test from "node:test";

import { validateShopProductImage } from "./product-image";

test("изображение товара принимает безопасные растровые форматы до 12 MB", () => {
  assert.equal(validateShopProductImage({ type: "image/webp", size: 2 * 1024 * 1024 }), null);
});

test("изображение товара отклоняет документы и слишком большие файлы", () => {
  assert.match(validateShopProductImage({ type: "application/pdf", size: 1024 }) ?? "", /JPG|PNG|WebP|AVIF/);
  assert.match(validateShopProductImage({ type: "image/jpeg", size: 13 * 1024 * 1024 }) ?? "", /12 MB/);
});
