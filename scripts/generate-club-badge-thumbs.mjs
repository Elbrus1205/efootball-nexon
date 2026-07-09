import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceDir = path.join(root, "public", "club-badges");
const outputDir = path.join(sourceDir, "thumbs");
const supportedExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);

await mkdir(outputDir, { recursive: true });

const entries = await readdir(sourceDir, { withFileTypes: true });
let generated = 0;
let skipped = 0;

for (const entry of entries) {
  if (!entry.isFile()) continue;

  const extension = path.extname(entry.name).toLowerCase();
  if (!supportedExtensions.has(extension)) continue;

  const inputPath = path.join(sourceDir, entry.name);
  const outputName = `${path.basename(entry.name, extension)}.webp`;
  const outputPath = path.join(outputDir, outputName);

  try {
    const [inputStat, outputStat] = await Promise.all([
      stat(inputPath),
      stat(outputPath).catch(() => null),
    ]);

    if (outputStat && outputStat.mtimeMs >= inputStat.mtimeMs) {
      skipped += 1;
      continue;
    }

    await sharp(inputPath)
      .resize(96, 96, {
        fit: "contain",
        withoutEnlargement: true,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 86, effort: 5 })
      .toFile(outputPath);

    generated += 1;
  } catch (error) {
    console.warn(`Failed to generate thumbnail for ${entry.name}:`, error instanceof Error ? error.message : error);
  }
}

console.log(`Club badge thumbnails: ${generated} generated, ${skipped} up to date.`);
