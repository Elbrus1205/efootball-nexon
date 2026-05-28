import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlayerCareerStats, type PlayerCareerStats } from "@/lib/player-stats";
import { createNotification } from "@/lib/services/notifications";

type AchievementMetric = "registered" | "wins" | "goalsFor" | "played" | "cleanSheets";
export type AchievementAccent = "gold" | "green" | "blue" | "violet" | "rose" | "zinc";

type AchievementLevelDefinition = {
  key: string;
  title: string;
  shortTitle: string;
  target: number;
  imagePath?: string;
};

type AchievementGroupDefinition = {
  key: string;
  title: string;
  description: string;
  metric: AchievementMetric;
  metricLabel: string;
  accent: AchievementAccent;
  baseImagePath?: string;
  levels: AchievementLevelDefinition[];
};

export type AchievementLevelProgress = AchievementLevelDefinition & {
  value: number;
  unlocked: boolean;
  achievedAt: Date | null;
  progressPercent: number;
};

export type AchievementGroupProgress = Omit<AchievementGroupDefinition, "levels"> & {
  value: number;
  imagePath?: string;
  unlockedCount: number;
  totalCount: number;
  currentLevel: AchievementLevelProgress | null;
  nextLevel: AchievementLevelProgress | null;
  levels: AchievementLevelProgress[];
};

export const achievementGroups: AchievementGroupDefinition[] = [
  {
    key: "registered",
    title: "Регистрация",
    description: "Зарегистрируйтесь на сайте.",
    metric: "registered",
    metricLabel: "Аккаунт",
    accent: "zinc",
    levels: [
      {
        key: "registered_site",
        title: "Зарегистрируйтесь на сайте",
        shortTitle: "Регистрация",
        target: 1,
      },
    ],
  },
  {
    key: "first_win",
    title: "Первая победа",
    description: "Выиграйте первый матч.",
    metric: "wins",
    metricLabel: "Победы",
    accent: "gold",
    levels: [
      {
        key: "first_match_win",
        title: "Выиграйте первый матч",
        shortTitle: "Первая победа",
        target: 1,
      },
    ],
  },
  {
    key: "wins",
    title: "Победите в матчах",
    description: "Побеждайте в подтверждённых матчах.",
    metric: "wins",
    metricLabel: "Победы",
    accent: "gold",
    baseImagePath: "/dostij/IMG_6654.PNG",
    levels: [
      { key: "wins_100", title: "Победите в 100 матчах", shortTitle: "100 побед", target: 100, imagePath: "/dostij/IMG_6655.PNG" },
      { key: "wins_500", title: "Победите в 500 матчах", shortTitle: "500 побед", target: 500, imagePath: "/dostij/IMG_6656.PNG" },
      { key: "wins_1500", title: "Победите в 1500 матчах", shortTitle: "1500 побед", target: 1500, imagePath: "/dostij/IMG_6657.PNG" },
      { key: "wins_3000", title: "Победите в 3000 матчах", shortTitle: "3000 побед", target: 3000, imagePath: "/dostij/IMG_6658.PNG" },
      { key: "wins_5000", title: "Победите в 5000 матчах", shortTitle: "5000 побед", target: 5000, imagePath: "/dostij/IMG_6659.PNG" },
    ],
  },
  {
    key: "goals",
    title: "Забейте голы",
    description: "Сумма голов во всех подтверждённых матчах.",
    metric: "goalsFor",
    metricLabel: "Голы",
    accent: "green",
    baseImagePath: "/dostij/IMG_6660.PNG",
    levels: [
      { key: "goals_100", title: "Забейте 100 голов", shortTitle: "100 голов", target: 100, imagePath: "/dostij/IMG_6661.PNG" },
      { key: "goals_500", title: "Забейте 500 голов", shortTitle: "500 голов", target: 500, imagePath: "/dostij/IMG_6662.PNG" },
      { key: "goals_2500", title: "Забейте 2500 голов", shortTitle: "2500 голов", target: 2500, imagePath: "/dostij/IMG_6663.PNG" },
      { key: "goals_5000", title: "Забейте 5000 голов", shortTitle: "5000 голов", target: 5000, imagePath: "/dostij/IMG_6664.PNG" },
      { key: "goals_10000", title: "Забейте 10000 голов", shortTitle: "10000 голов", target: 10000, imagePath: "/dostij/IMG_6665.PNG" },
    ],
  },
  {
    key: "played",
    title: "Сыграйте матчей",
    description: "Учитываются подтверждённые матчи.",
    metric: "played",
    metricLabel: "Матчи",
    accent: "blue",
    baseImagePath: "/dostij/IMG_6680.PNG",
    levels: [
      { key: "played_100", title: "Сыграйте 100 матчей", shortTitle: "100 матчей", target: 100, imagePath: "/dostij/IMG_6681.PNG" },
      { key: "played_1000", title: "Сыграйте 1000 матчей", shortTitle: "1000 матчей", target: 1000, imagePath: "/dostij/IMG_6682.PNG" },
      { key: "played_5000", title: "Сыграйте 5000 матчей", shortTitle: "5000 матчей", target: 5000, imagePath: "/dostij/IMG_6683.PNG" },
      { key: "played_10000", title: "Сыграйте 10000 матчей", shortTitle: "10000 матчей", target: 10000, imagePath: "/dostij/IMG_6684.PNG" },
      { key: "played_15000", title: "Сыграйте 15000 матчей", shortTitle: "15000 матчей", target: 15000, imagePath: "/dostij/IMG_6685.PNG" },
    ],
  },
  {
    key: "clean_sheets",
    title: "Проведите сухие матчи",
    description: "Матчи, где вы не пропустили голов.",
    metric: "cleanSheets",
    metricLabel: "Сухие матчи",
    accent: "violet",
    levels: [
      { key: "clean_sheets_10", title: "Проведите 10 сухих матчей", shortTitle: "10 сухих", target: 10 },
      { key: "clean_sheets_100", title: "Проведите 100 сухих матчей", shortTitle: "100 сухих", target: 100 },
      { key: "clean_sheets_500", title: "Проведите 500 сухих матчей", shortTitle: "500 сухих", target: 500 },
      { key: "clean_sheets_1000", title: "Проведите 1000 сухих матчей", shortTitle: "1000 сухих", target: 1000 },
      { key: "clean_sheets_3000", title: "Проведите 3000 сухих матчей", shortTitle: "3000 сухих", target: 3000 },
    ],
  },
];

function metricValue(metric: AchievementMetric, stats: PlayerCareerStats) {
  if (metric === "registered") return 1;
  return stats[metric];
}

export async function getUserAchievementProgress(userId: string, stats?: PlayerCareerStats): Promise<AchievementGroupProgress[]> {
  const [careerStats, records] = await Promise.all([
    stats ? Promise.resolve(stats) : getPlayerCareerStats(userId),
    db.userAchievement.findMany({
      where: { userId },
      select: { achievementKey: true, achievedAt: true },
    }),
  ]);
  const achievedAtByKey = new Map(records.map((record) => [record.achievementKey, record.achievedAt]));

  return achievementGroups.map((group) => {
    const value = metricValue(group.metric, careerStats);
    const levels = group.levels.map((level) => {
      const unlocked = value >= level.target;

      return {
        ...level,
        value,
        unlocked,
        achievedAt: achievedAtByKey.get(level.key) ?? null,
        progressPercent: Math.min(100, Math.round((value / level.target) * 100)),
      };
    });
    const unlockedLevels = levels.filter((level) => level.unlocked);
    const currentLevel = unlockedLevels.at(-1) ?? null;
    const nextLevel = levels.find((level) => !level.unlocked) ?? null;

    return {
      ...group,
      value,
      levels,
      imagePath: currentLevel?.imagePath ?? group.baseImagePath,
      unlockedCount: unlockedLevels.length,
      totalCount: levels.length,
      currentLevel,
      nextLevel,
    };
  });
}

export async function syncUserAchievements(userId: string) {
  const progress = await getUserAchievementProgress(userId);
  const unlockedLevels = progress.flatMap((group) => group.levels.filter((level) => level.unlocked));
  if (!unlockedLevels.length) return;

  const existing = await db.userAchievement.findMany({
    where: {
      userId,
      achievementKey: { in: unlockedLevels.map((level) => level.key) },
    },
    select: { achievementKey: true },
  });
  const existingKeys = new Set(existing.map((item) => item.achievementKey));
  const newLevels = unlockedLevels.filter((level) => !existingKeys.has(level.key));
  if (!newLevels.length) return;

  await Promise.all(
    newLevels.map(async (level) => {
      const achieved = await db.userAchievement.upsert({
        where: {
          userId_achievementKey: {
            userId,
            achievementKey: level.key,
          },
        },
        update: {},
        create: {
          userId,
          achievementKey: level.key,
        },
      });

      if (!achieved.notifiedAt) {
        await createNotification({
          userId,
          title: "Новое достижение",
          body: `Открыто: ${level.title}. Прогресс: ${level.value}/${level.target}.`,
          type: NotificationType.SYSTEM,
          link: "/dashboard",
          dedupeWithinHours: 24,
        });

        await db.userAchievement.update({
          where: { id: achieved.id },
          data: { notifiedAt: new Date() },
        });
      }
    }),
  );
}

export async function syncUserAchievementsForUsers(userIds: Array<string | null | undefined>) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean) as string[]));
  await Promise.all(uniqueUserIds.map((userId) => syncUserAchievements(userId)));
}
