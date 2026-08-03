const SHOP_PRODUCT_IMAGE_TYPES = new Set(["image/avif", "image/png", "image/jpeg", "image/webp"]);
export const SHOP_PRODUCT_IMAGE_MAX_BYTES = 12 * 1024 * 1024;

export function validateShopProductImage(file: { type: string; size: number }) {
  if (!SHOP_PRODUCT_IMAGE_TYPES.has(file.type)) return "Выберите изображение JPG, PNG, WebP или AVIF.";
  if (file.size > SHOP_PRODUCT_IMAGE_MAX_BYTES) return "Максимальный размер изображения — 12 MB.";
  return null;
}
