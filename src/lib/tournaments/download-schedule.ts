import { canvasToBlob, downloadFiles, type DownloadFile } from "@/lib/image-download";
import { balancedSchedulePages, schedulePosterFixtures, type ExportScheduleRound } from "@/lib/tournaments/schedule-poster";
import { renderSchedulePoster } from "@/lib/tournaments/schedule-poster-canvas";

function fileSlug(value: string) {
  return value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 100) || "schedule";
}

export async function downloadScheduleImages(rounds: ExportScheduleRound[], onProgress?: (label: string) => void) {
  const prepared = rounds.map((round) => ({ round, fixtures: schedulePosterFixtures(round.matches) }));
  const pageCount = prepared.reduce((count, { fixtures }) => count + balancedSchedulePages(fixtures).length, 0);
  if (!pageCount) throw new Error("Нет матчей для скачивания. Выберите другой тур.");
  const files: DownloadFile[] = [];
  for (const { round, fixtures } of prepared) {
    const pages = balancedSchedulePages(fixtures);
    const totalMatchCount = fixtures.reduce((sum, fixture) => sum + fixture.matchCount, 0);
    for (const [index, page] of pages.entries()) {
      onProgress?.(`Готовлю изображение ${files.length + 1} из ${pageCount}…`);
      const canvas = await renderSchedulePoster(round, page, totalMatchCount);
      try {
        const blob = await canvasToBlob(canvas);
        if (!blob) throw new Error("Не удалось сохранить PNG. Попробуйте скачать один тур.");
        files.push({ name: `${fileSlug(round.title)}-${fileSlug(round.key)}-${index + 1}.png`, blob });
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  }
  await downloadFiles(files, "nexon-schedule.zip");
  return files.length;
}
