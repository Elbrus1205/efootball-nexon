import { promises as fs } from "fs";
import path from "path";

export type ClubOption = {
  slug: string;
  name: string;
  imagePath: string;
};

const CLUBS_DIR = path.join(process.cwd(), "public", "club-badges");
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

const CLUB_NAME_BY_FILE: Record<string, string> = {
  "arsenal.png": "Арсенал",
  "aston-villa.png": "Астон Вилла",
  "atalanta.png": "Аталанта",
  "athletic-club-big-2013 (1).png": "Атлетик Бильбао",
  "atletico-madrid.png": "Атлетико Мадрид",
  "barcelona.png": "Барселона",
  "bayer-04-leverkusen.png": "Байер 04",
  "bayern-munich-big-768x768.png": "Бавария",
  "benfica.png": "Бенфика",
  "bologna-big.png": "Болонья",
  "borussia-dortmund.png": "Боруссия Дортмунд",
  "bournemouth-big.png": "Борнмут",
  "brentford-big-768x768.png": "Брентфорд",
  "brighton-hove-albion-big-768x773.png": "Брайтон",
  "burnley-big-2023 (1).png": "Бернли",
  "chelsea.png": "Челси",
  "como-1907-big-768x794.png": "Комо",
  "crystal-palace-big-2022.png": "Кристал Пэлас",
  "eintracht-frankfurt-big-768x768.png": "Айнтрахт Франкфурт",
  "everton-big-768x786.png": "Эвертон",
  "fenerbahce.png": "Фенербахче",
  "fulham-big.png": "Фулхэм",
  "galatasaray-big.png": "Галатасарай",
  "inter-milan.png": "Интер",
  "juventus.png": "Ювентус",
  "leeds-united-big (1).png": "Лидс Юнайтед",
  "liverpool.png": "Ливерпуль",
  "manchester-city.png": "Манчестер Сити",
  "manchester-united.png": "Манчестер Юнайтед",
  "marseille.png": "Марсель",
  "milan.png": "Милан",
  "monaco.png": "Монако",
  "napoli-big-2024-768x768.png": "Наполи",
  "newcastle-united-big-768x774.png": "Ньюкасл Юнайтед",
  "nottingham-forest-big.png": "Ноттингем Форест",
  "porto.png": "Порту",
  "psg-big-768x768.png": "ПСЖ",
  "psv-eindhoven-big-768x630.png": "ПСВ",
  "real-betis.png": "Реал Бетис",
  "real-madrid.png": "Реал Мадрид",
  "roma-big (1).png": "Рома",
  "sporting.png": "Спортинг",
  "strasbourg-big-768x768.png": "Страсбур",
  "sunderland-big-768x640 (1).png": "Сандерленд",
  "tottenham-hotspur.png": "Тоттенхэм",
  "villarreal-big.png": "Вильярреал",
  "west-ham-united.png": "Вест Хэм",
  "wolverhampton-wanderers-big-768x666.png": "Вулверхэмптон",
};

function prettifyClubName(fileName: string) {
  const extension = path.extname(fileName);
  const slug = path.basename(fileName, extension);

  return slug
    .replace(/\([^)]*\)/g, "")
    .replace(/\b\d+x\d+\b/gi, "")
    .replace(/\b\d{4}\b/g, "")
    .replace(/\b(big)\b/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getAvailableClubs() {
  try {
    const entries = await fs.readdir(CLUBS_DIR, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isFile())
      .filter((entry) => IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => {
        const extension = path.extname(entry.name);
        const slug = path.basename(entry.name, extension);

        return {
          slug,
          name: CLUB_NAME_BY_FILE[entry.name] ?? prettifyClubName(entry.name),
          imagePath: `/club-badges/${entry.name}`,
        } satisfies ClubOption;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  } catch {
    return [] as ClubOption[];
  }
}
