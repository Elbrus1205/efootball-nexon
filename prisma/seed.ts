import { randomInt } from "crypto";
import { PrismaClient, TournamentFormat, TournamentStatus, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { slugify } from "../src/lib/utils";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hash("Admin12345!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@efoottourney.local" },
    update: {},
    create: {
      publicId: String(randomInt(1_000_000_000, 10_000_000_000)),
      email: "admin@efoottourney.local",
      passwordHash: adminPassword,
      name: "Admin",
      role: UserRole.FOUNDER,
    },
  });

  const title = "Spring eFootball Cup";
  await prisma.tournament.upsert({
    where: { slug: slugify(title) },
    update: {},
    create: {
      slug: slugify(title),
      title,
      description: "",
      rules: "Bo1, обязательный скриншот результата, задержка не более 10 минут.",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      registrationEndsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      maxParticipants: 16,
      prizePool: "5 000 ₽",
      format: TournamentFormat.SINGLE_ELIMINATION,
      status: TournamentStatus.REGISTRATION_OPEN,
      createdById: admin.id,
    },
  });

  await prisma.shopSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      isEnabled: false,
      showHomeBlock: true,
      termsVersion: "shop-2026-08-26-beks-konami",
      updatedById: admin.id,
    },
  });

  await Promise.all([
    prisma.shopCategory.upsert({
      where: { slug: "in-game-donations" },
      update: {},
      create: {
        slug: "in-game-donations",
        name: "Внутриигровые донаты",
        description: "Товары, способ получения которых разрешён правилами игры и платформы.",
        sortOrder: 10,
        createdById: admin.id,
      },
    }),
    prisma.shopCategory.upsert({
      where: { slug: "promotional-donations" },
      update: {},
      create: {
        slug: "promotional-donations",
        name: "Акционные донаты",
        description: "Ограниченные по времени предложения без искусственной срочности.",
        sortOrder: 20,
        createdById: admin.id,
      },
    }),
  ]);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
