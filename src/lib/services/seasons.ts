import { db } from "@/lib/db";
import { createSeasonStatusNominations } from "@/lib/profile-statuses";
import { slugify } from "@/lib/utils";

function normalizeSeasonName(name: FormDataEntryValue | null) {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
}

function makeSeasonSlug(name: string) {
  const base = slugify(name) || "season";
  return `${base}-${Date.now()}`;
}

export async function getActiveSeason() {
  return db.season.findFirst({
    where: { isActive: true },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createSeason(rawName: FormDataEntryValue | null) {
  const name = normalizeSeasonName(rawName);

  if (name.length < 2) {
    throw new Error("Название сезона должно быть не короче 2 символов.");
  }

  const now = new Date();
  const previousActiveSeason = await getActiveSeason();

  const season = await db.$transaction(async (tx) => {
    await tx.season.updateMany({
      where: { isActive: true },
      data: { isActive: false, endsAt: now },
    });

    return tx.season.create({
      data: {
        name,
        slug: makeSeasonSlug(name),
        startsAt: now,
        isActive: true,
      },
    });
  });

  if (previousActiveSeason) {
    await createSeasonStatusNominations(previousActiveSeason.id);
  }

  return season;
}

export async function deleteSeason(seasonId: string) {
  await db.$transaction(async (tx) => {
    await tx.tournament.updateMany({
      where: { seasonId },
      data: { seasonId: null },
    });

    await tx.season.delete({ where: { id: seasonId } });
  });
}

export async function clearSeasons() {
  await db.$transaction(async (tx) => {
    await tx.tournament.updateMany({
      where: { seasonId: { not: null } },
      data: { seasonId: null },
    });

    await tx.season.deleteMany();
  });
}
