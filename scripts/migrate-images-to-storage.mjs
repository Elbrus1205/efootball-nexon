import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "public-media";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them before running the migration.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function parseDataUrl(value) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value ?? "");
  if (!match) return null;
  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const data = match[3] ?? "";
  const bytes = isBase64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8");
  return { contentType, bytes };
}

async function uploadDataUrl(folder, value) {
  const parsed = parseDataUrl(value);
  if (!parsed) return null;
  const ext = EXT_BY_MIME[parsed.contentType] ?? "bin";
  const path = `${folder}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, parsed.bytes, {
    contentType: parsed.contentType,
    upsert: false,
  });
  if (error) throw new Error(`upload failed for ${folder}: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function migrateField({ label, folder, rows, field, update }) {
  let migrated = 0;
  let skipped = 0;
  for (const row of rows) {
    const value = row[field];
    if (typeof value !== "string" || !value.startsWith("data:")) {
      skipped += 1;
      continue;
    }
    try {
      const url = await uploadDataUrl(folder, value);
      if (!url) {
        skipped += 1;
        continue;
      }
      await update(row.id, url);
      migrated += 1;
      console.log(`  [${label}] ${row.id} -> ${url}`);
    } catch (error) {
      console.error(`  [${label}] FAILED ${row.id}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`[${label}] migrated=${migrated} skipped=${skipped} total=${rows.length}`);
}

async function main() {
  console.log("Migrating base64 images to Supabase Storage...\n");

  const usersWithImage = await prisma.user.findMany({
    where: { image: { startsWith: "data:" } },
    select: { id: true, image: true },
  });
  await migrateField({
    label: "User.image",
    folder: "avatars",
    rows: usersWithImage,
    field: "image",
    update: (id, url) => prisma.user.update({ where: { id }, data: { image: url } }),
  });

  const usersWithBanner = await prisma.user.findMany({
    where: { bannerImage: { startsWith: "data:" } },
    select: { id: true, bannerImage: true },
  });
  await migrateField({
    label: "User.bannerImage",
    folder: "banners",
    rows: usersWithBanner,
    field: "bannerImage",
    update: (id, url) => prisma.user.update({ where: { id }, data: { bannerImage: url } }),
  });

  const tournaments = await prisma.tournament.findMany({
    where: { coverImage: { startsWith: "data:" } },
    select: { id: true, coverImage: true },
  });
  await migrateField({
    label: "Tournament.coverImage",
    folder: "tournaments",
    rows: tournaments,
    field: "coverImage",
    update: (id, url) => prisma.tournament.update({ where: { id }, data: { coverImage: url } }),
  });

  const divisions = await prisma.divisionSettings.findMany({
    where: { coverImage: { startsWith: "data:" } },
    select: { id: true, coverImage: true },
  });
  await migrateField({
    label: "DivisionSettings.coverImage",
    folder: "divisions",
    rows: divisions,
    field: "coverImage",
    update: (id, url) => prisma.divisionSettings.update({ where: { id }, data: { coverImage: url } }),
  });

  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
