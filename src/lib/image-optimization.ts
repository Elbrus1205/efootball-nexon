type ImageTransformOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
  format?: "webp" | "origin";
};

function isSupabaseStorageUrl(url: URL) {
  return url.pathname.includes("/storage/v1/object/public/") || url.pathname.includes("/storage/v1/object/sign/");
}

export function isInlineImageUrl(src?: string | null) {
  return Boolean(src?.startsWith("data:") || src?.startsWith("blob:"));
}

export function optimizedImageUrl(src?: string | null, options: ImageTransformOptions = {}) {
  if (!src || isInlineImageUrl(src)) return src ?? undefined;
  if (src.startsWith("/")) return src;

  try {
    const url = new URL(src);
    if (!isSupabaseStorageUrl(url)) return src;

    url.pathname = url.pathname
      .replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")
      .replace("/storage/v1/object/sign/", "/storage/v1/render/image/sign/");

    if (options.width) url.searchParams.set("width", String(options.width));
    if (options.height) url.searchParams.set("height", String(options.height));
    if (options.quality) url.searchParams.set("quality", String(options.quality));
    if (options.resize) url.searchParams.set("resize", options.resize);
    if (options.format) url.searchParams.set("format", options.format);

    return url.toString();
  } catch {
    return src;
  }
}
