import { canvasToBlob, downloadFiles, type DownloadFile } from "@/lib/image-download";
import { loadPosterBadges } from "@/lib/tournaments/schedule-poster-canvas";
import { standingsPosterPages, type ExportGroup } from "@/lib/tournaments/standings-poster";

const colors = { background: "#101112", surface: "#191b1d", line: "#323436", text: "#f3f1ec", muted: "#b0b2b4", gold: "#c8b58b" };

export async function renderStandingsPoster(tournamentTitle: string, page: ReturnType<typeof standingsPosterPages>[number]) {
  await document.fonts.ready;
  const badges = await loadPosterBadges(page.rows.map((row) => row.clubBadgePath));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не смог создать изображение.");
  const font = getComputedStyle(document.body).fontFamily || "Arial, sans-serif";
  const text = (value: string, x: number, y: number, width: number, size = 28, color = colors.text, align: CanvasTextAlign = "left", weight = 600) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    const chars = Array.from(value);
    if (ctx.measureText(value).width > width) {
      while (chars.length && ctx.measureText(`${chars.join("")}…`).width > width) chars.pop();
      chars.push("…");
    }
    ctx.fillText(chars.join(""), x, y);
  };
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, 1600, 1600);
  const light = ctx.createLinearGradient(0, 0, 1600, 1600);
  light.addColorStop(0, "rgba(200,181,139,0.09)");
  light.addColorStop(0.6, "rgba(200,181,139,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, 1600, 1600);
  ctx.fillStyle = colors.gold;
  ctx.fillRect(64, 57, 48, 4);
  text("EFOOTBALL NEXON", 132, 68, 500, 24, colors.gold);
  text(tournamentTitle, 1536, 68, 780, 24, colors.muted, "right", 400);
  text(page.table.stageName, 64, 137, 1472, 30, colors.muted, "left", 400);
  text(page.table.name, 64, 220, 1472, 68);
  text(page.table.kind === "leagues" ? "ТАБЛИЦА ЛИГИ" : "ТАБЛИЦА ГРУППЫ", 64, 278, 900, 22, colors.gold);
  text(`Участников: ${page.table.rows.length}`, 1536, 278, 450, 25, colors.muted, "right", 400);

  const top = 332;
  const rowHeight = Math.min(148, 1056 / Math.max(page.rows.length, 1));
  const columns = [960, 1060, 1160, 1260, 1370, 1490];
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.roundRect(64, top, 1472, 64, 14);
  ctx.fill();
  text("#", 105, top + 42, 60, 24, colors.muted, "center");
  text("КОМАНДА / ИГРОК", 164, top + 42, 700, 22, colors.muted);
  ["И", "В", "Н", "П", "+/−", "О"].forEach((label, i) => text(label, columns[i], top + 42, 88, 24, colors.muted, "center"));

  page.rows.forEach((row, index) => {
    const y = top + 76 + index * rowHeight;
    const center = y + rowHeight / 2;
    if (index % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(64, y, 1472, rowHeight);
    }
    text(String(row.rank), 105, center + 10, 60, 29, row.rank === 1 ? colors.gold : colors.muted, "center");
    const badge = row.clubBadgePath ? badges.get(row.clubBadgePath) : null;
    if (badge) {
      const scale = Math.min(54 / badge.naturalWidth, 54 / badge.naturalHeight);
      const w = badge.naturalWidth * scale;
      const h = badge.naturalHeight * scale;
      ctx.drawImage(badge, 190 - w / 2, center - h / 2, w, h);
    } else {
      text(row.clubName.slice(0, 2).toUpperCase(), 190, center + 8, 54, 22, colors.gold, "center");
    }
    text(row.clubName, 240, center - 5, 650, 32);
    text(row.playerName, 240, center + 28, 650, 24, colors.muted, "left", 400);
    const values = [row.played, row.wins, row.draws, row.losses, row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference, row.points];
    values.forEach((value, i) => text(String(value), columns[i], center + 11, 88, i === 5 ? 34 : 29, i === 5 ? colors.gold : colors.text, "center"));
  });
  if (!page.rows.length) text("Участники ещё не распределены", 800, 700, 1350, 36, colors.muted, "center", 400);
  ctx.fillStyle = colors.line;
  ctx.fillRect(64, 1500, 1472, 1);
  text("И — игры   В — победы   Н — ничьи   П — поражения   О — очки", 64, 1548, 1110, 21, colors.muted, "left", 400);
  text(`${page.page} / ${page.pageCount}`, 1536, 1548, 240, 24, colors.gold, "right");
  return canvas;
}

export async function downloadStandingsImages(tournamentTitle: string, tables: ExportGroup[], onProgress: (label: string) => void) {
  const pages = standingsPosterPages(tables);
  if (!pages.length) throw new Error("Выберите группу или лигу.");
  const files: DownloadFile[] = [];
  for (const page of pages) {
    onProgress(`Готовлю таблицу ${files.length + 1} из ${pages.length}…`);
    const canvas = await renderStandingsPoster(tournamentTitle, page);
    try {
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("Не удалось сохранить PNG.");
      const name = `${page.table.stageName}-${page.table.name}`.replace(/[^a-zа-яё0-9]+/gi, "-").slice(0, 100);
      files.push({ name: `${name}-${files.length + 1}-page-${page.page}.png`, blob });
    } finally {
      canvas.width = canvas.height = 0;
    }
  }
  await downloadFiles(files, "nexon-tables.zip");
  return files.length;
}
