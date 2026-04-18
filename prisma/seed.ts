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
      email: "admin@efoottourney.local",
      passwordHash: adminPassword,
      name: "Admin",
      nickname: "TournamentAdmin",
      efootballUid: "UID-ADMIN-001",
      role: UserRole.ADMIN,
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
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
