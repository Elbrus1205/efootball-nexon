import { promises as fs } from "fs";
import path from "path";

export type ClubOption = {
  slug: string;
  name: string;
  imagePath: string;
};

const CLUBS_DIR = path.join(process.cwd(), "public", "club-badges");

function prettifyClubName(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getAvailableClubs() {
  try {
    const entries = await fs.readdir(CLUBS_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const extension = path.extname(entry.name);
        const slug = path.basename(entry.name, extension);
        return {
          slug,
          name: prettifyClubName(slug),
          imagePath: `/club-badges/${entry.name}`,
        } satisfies ClubOption;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  } catch {
    return [] as ClubOption[];
  }
}
