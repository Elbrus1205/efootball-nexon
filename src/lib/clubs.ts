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
  "arsenal.png": "\u0410\u0440\u0441\u0435\u043d\u0430\u043b",
  "aston-villa.png": "\u0410\u0441\u0442\u043e\u043d \u0412\u0438\u043b\u043b\u0430",
  "atalanta.png": "\u0410\u0442\u0430\u043b\u0430\u043d\u0442\u0430",
  "athletic-club-big-2013 (1).png": "\u0410\u0442\u043b\u0435\u0442\u0438\u043a \u0411\u0438\u043b\u044c\u0431\u0430\u043e",
  "atletico-madrid.png": "\u0410\u0442\u043b\u0435\u0442\u0438\u043a\u043e \u041c\u0430\u0434\u0440\u0438\u0434",
  "barcelona.png": "\u0411\u0430\u0440\u0441\u0435\u043b\u043e\u043d\u0430",
  "bayer-04-leverkusen.png": "\u0411\u0430\u0439\u0435\u0440 04",
  "bayern-munich-big-768x768.png": "\u0411\u0430\u0432\u0430\u0440\u0438\u044f",
  "benfica.png": "\u0411\u0435\u043d\u0444\u0438\u043a\u0430",
  "bologna-big.png": "\u0411\u043e\u043b\u043e\u043d\u044c\u044f",
  "borussia-dortmund.png": "\u0411\u043e\u0440\u0443\u0441\u0441\u0438\u044f \u0414\u043e\u0440\u0442\u043c\u0443\u043d\u0434",
  "bournemouth-big.png": "\u0411\u043e\u0440\u043d\u043c\u0443\u0442",
  "brentford-big-768x768.png": "\u0411\u0440\u0435\u043d\u0442\u0444\u043e\u0440\u0434",
  "brighton-hove-albion-big-768x773.png": "\u0411\u0440\u0430\u0439\u0442\u043e\u043d",
  "burnley-big-2023 (1).png": "\u0411\u0435\u0440\u043d\u043b\u0438",
  "chelsea.png": "\u0427\u0435\u043b\u0441\u0438",
  "como-1907-big-768x794.png": "\u041a\u043e\u043c\u043e",
  "crystal-palace-big-2022.png": "\u041a\u0440\u0438\u0441\u0442\u0430\u043b \u041f\u044d\u043b\u0430\u0441",
  "eintracht-frankfurt-big-768x768.png": "\u0410\u0439\u043d\u0442\u0440\u0430\u0445\u0442 \u0424\u0440\u0430\u043d\u043a\u0444\u0443\u0440\u0442",
  "everton-big-768x786.png": "\u042d\u0432\u0435\u0440\u0442\u043e\u043d",
  "fenerbahce.png": "\u0424\u0435\u043d\u0435\u0440\u0431\u0430\u0445\u0447\u0435",
  "fulham-big.png": "\u0424\u0443\u043b\u0445\u044d\u043c",
  "galatasaray-big.png": "\u0413\u0430\u043b\u0430\u0442\u0430\u0441\u0430\u0440\u0430\u0439",
  "inter-milan.png": "\u0418\u043d\u0442\u0435\u0440",
  "juventus.png": "\u042e\u0432\u0435\u043d\u0442\u0443\u0441",
  "leeds-united-big (1).png": "\u041b\u0438\u0434\u0441 \u042e\u043d\u0430\u0439\u0442\u0435\u0434",
  "liverpool.png": "\u041b\u0438\u0432\u0435\u0440\u043f\u0443\u043b\u044c",
  "manchester-city.png": "\u041c\u0430\u043d\u0447\u0435\u0441\u0442\u0435\u0440 \u0421\u0438\u0442\u0438",
  "manchester-united.png": "\u041c\u0430\u043d\u0447\u0435\u0441\u0442\u0435\u0440 \u042e\u043d\u0430\u0439\u0442\u0435\u0434",
  "marseille.png": "\u041c\u0430\u0440\u0441\u0435\u043b\u044c",
  "milan.png": "\u041c\u0438\u043b\u0430\u043d",
  "monaco.png": "\u041c\u043e\u043d\u0430\u043a\u043e",
  "napoli-big-2024-768x768.png": "\u041d\u0430\u043f\u043e\u043b\u0438",
  "newcastle-united-big-768x774.png": "\u041d\u044c\u044e\u043a\u0430\u0441\u043b \u042e\u043d\u0430\u0439\u0442\u0435\u0434",
  "nottingham-forest-big.png": "\u041d\u043e\u0442\u0442\u0438\u043d\u0433\u0435\u043c \u0424\u043e\u0440\u0435\u0441\u0442",
  "porto.png": "\u041f\u043e\u0440\u0442\u0443",
  "psg-big-768x768.png": "\u041f\u0421\u0416",
  "psv-eindhoven-big-768x630.png": "\u041f\u0421\u0412",
  "real-betis.png": "\u0420\u0435\u0430\u043b \u0411\u0435\u0442\u0438\u0441",
  "real-madrid.png": "\u0420\u0435\u0430\u043b \u041c\u0430\u0434\u0440\u0438\u0434",
  "roma-big (1).png": "\u0420\u043e\u043c\u0430",
  "sporting.png": "\u0421\u043f\u043e\u0440\u0442\u0438\u043d\u0433",
  "strasbourg-big-768x768.png": "\u0421\u0442\u0440\u0430\u0441\u0431\u0443\u0440",
  "sunderland-big-768x640 (1).png": "\u0421\u0430\u043d\u0434\u0435\u0440\u043b\u0435\u043d\u0434",
  "tottenham-hotspur.png": "\u0422\u043e\u0442\u0442\u0435\u043d\u0445\u044d\u043c",
  "villarreal-big.png": "\u0412\u0438\u043b\u044c\u044f\u0440\u0440\u0435\u0430\u043b",
  "west-ham-united.png": "\u0412\u0435\u0441\u0442 \u0425\u044d\u043c",
  "wolverhampton-wanderers-big-768x666.png": "\u0412\u0443\u043b\u0432\u0435\u0440\u0445\u044d\u043c\u043f\u0442\u043e\u043d",
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
