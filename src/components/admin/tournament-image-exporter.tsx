"use client";

import { CalendarDays, CheckSquare, Download, ImageDown, Layers3, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ExportGroupRow = {
  rank: number;
  clubName: string;
  playerName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  points: number;
};

export type ExportGroup = {
  id: string;
  name: string;
  rows: ExportGroupRow[];
};

export type ExportScheduleMatch = {
  id: string;
  groupName: string | null;
  matchNumber: number;
  player1ClubName: string;
  player1Name: string;
  player2ClubName: string;
  player2Name: string;
  scoreLabel: string;
};

export type ExportScheduleRound = {
  key: string;
  title: string;
  matches: ExportScheduleMatch[];
};

type CanvasTextOptions = {
  font?: string;
  fill?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
};

const CANVAS_SIZE = 1600;
const COLORS = {
  black: "#070707",
  panel: "#101010",
  panelSoft: "#151515",
  line: "#333333",
  gold: "#D4AF37",
  goldSoft: "#8D7425",
  white: "#F5F5F5",
  muted: "#C8C8C8",
  dim: "#7A7A7A",
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  return canvas;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRound(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRound(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, stroke: string, lineWidth = 2) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, options: CanvasTextOptions = {}) {
  ctx.font = options.font ?? "24px Inter, Arial, sans-serif";
  ctx.fillStyle = options.fill ?? COLORS.white;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = options.baseline ?? "alphabetic";

  let output = value;
  while (output.length > 1 && ctx.measureText(output).width > maxWidth) {
    output = `${output.slice(0, -2)}…`;
  }

  ctx.fillText(output, x, y);
}

function centeredText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, options: CanvasTextOptions = {}) {
  text(ctx, value, x, y, maxWidth, { ...options, align: "center" });
}

function teamMark(value: string) {
  const parts = value
    .replace(/[^A-Za-zА-Яа-яЁё0-9\s-]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean);

  if (!parts.length) return "FC";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLORS.black;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const gradient = ctx.createRadialGradient(1120, 130, 40, 1120, 130, 980);
  gradient.addColorStop(0, "rgba(212, 175, 55, 0.16)");
  gradient.addColorStop(0.4, "rgba(212, 175, 55, 0.04)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1;
  for (let position = 90; position < CANVAS_SIZE; position += 90) {
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position - 360, CANVAS_SIZE);
    ctx.stroke();
  }
}

function drawHeader(ctx: CanvasRenderingContext2D, tournamentTitle: string, title: string, subtitle: string) {
  text(ctx, "EFOOTBALL NEXON", 82, 96, 620, {
    font: "700 34px Inter, Arial, sans-serif",
    fill: COLORS.white,
  });
  text(ctx, "GLOBAL MOBILE CHAMPIONSHIP", 82, 142, 680, {
    font: "600 20px Inter, Arial, sans-serif",
    fill: COLORS.gold,
  });
  text(ctx, tournamentTitle.toUpperCase(), 82, 226, 900, {
    font: "300 64px Inter, Arial, sans-serif",
    fill: COLORS.white,
  });
  text(ctx, title, 82, 282, 820, {
    font: "700 32px Inter, Arial, sans-serif",
    fill: COLORS.muted,
  });
  text(ctx, subtitle, 82, 324, 820, {
    font: "500 22px Inter, Arial, sans-serif",
    fill: COLORS.dim,
  });

  strokeRound(ctx, 1186, 80, 330, 72, 12, "rgba(212, 175, 55, 0.46)", 2);
  centeredText(ctx, "PNG EXPORT", 1351, 126, 260, {
    font: "700 24px Inter, Arial, sans-serif",
    fill: COLORS.gold,
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, pageLabel: string) {
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(82, 1506);
  ctx.lineTo(1518, 1506);
  ctx.stroke();

  text(ctx, "efootball-nexon.com", 82, 1550, 520, {
    font: "600 24px Inter, Arial, sans-serif",
    fill: COLORS.muted,
  });
  text(ctx, pageLabel, 1518, 1550, 460, {
    font: "600 24px Inter, Arial, sans-serif",
    fill: COLORS.dim,
    align: "right",
  });
}

function drawGroupCard(ctx: CanvasRenderingContext2D, group: ExportGroup, x: number, y: number, width: number, height: number) {
  fillRound(ctx, x, y, width, height, 24, COLORS.panel);
  strokeRound(ctx, x, y, width, height, 24, "rgba(212, 175, 55, 0.34)", 2);

  text(ctx, group.name.toUpperCase(), x + 30, y + 48, width - 60, {
    font: "800 28px Inter, Arial, sans-serif",
    fill: COLORS.white,
  });
  text(ctx, `${group.rows.length} игроков`, x + width - 30, y + 48, 180, {
    font: "600 20px Inter, Arial, sans-serif",
    fill: COLORS.gold,
    align: "right",
  });

  const tableTop = y + 84;
  const rowHeight = Math.min(42, Math.max(28, (height - 132) / Math.max(group.rows.length, 1)));
  const shownRows = group.rows.slice(0, Math.floor((height - 132) / rowHeight));

  ctx.fillStyle = COLORS.panelSoft;
  ctx.fillRect(x + 22, tableTop, width - 44, 38);

  const columns = [
    { label: "#", offset: 26, width: 42, align: "center" as CanvasTextAlign },
    { label: "Команда", offset: 78, width: width - 374, align: "left" as CanvasTextAlign },
    { label: "И", offset: width - 280, width: 34, align: "center" as CanvasTextAlign },
    { label: "В", offset: width - 238, width: 34, align: "center" as CanvasTextAlign },
    { label: "Н", offset: width - 196, width: 34, align: "center" as CanvasTextAlign },
    { label: "П", offset: width - 154, width: 34, align: "center" as CanvasTextAlign },
    { label: "+/-", offset: width - 108, width: 48, align: "center" as CanvasTextAlign },
    { label: "О", offset: width - 48, width: 38, align: "center" as CanvasTextAlign },
  ];

  for (const column of columns) {
    text(ctx, column.label, x + column.offset, tableTop + 25, column.width, {
      font: "700 16px Inter, Arial, sans-serif",
      fill: COLORS.dim,
      align: column.align,
    });
  }

  shownRows.forEach((row, index) => {
    const rowY = tableTop + 38 + index * rowHeight;
    if (index % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      ctx.fillRect(x + 22, rowY, width - 44, rowHeight);
    }

    const rankColor = row.rank === 1 ? COLORS.gold : row.rank <= 3 ? COLORS.white : COLORS.muted;
    text(ctx, String(row.rank), x + 48, rowY + rowHeight * 0.65, 42, {
      font: "800 18px Inter, Arial, sans-serif",
      fill: rankColor,
      align: "center",
    });
    text(ctx, row.clubName, x + 78, rowY + rowHeight * 0.48, width - 374, {
      font: "700 19px Inter, Arial, sans-serif",
      fill: COLORS.white,
    });
    text(ctx, row.playerName, x + 78, rowY + rowHeight * 0.84, width - 374, {
      font: "500 15px Inter, Arial, sans-serif",
      fill: COLORS.dim,
    });

    const values = [row.played, row.wins, row.draws, row.losses, row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference, row.points];
    const valueOffsets = [width - 280, width - 238, width - 196, width - 154, width - 108, width - 48];
    values.forEach((value, valueIndex) => {
      text(ctx, String(value), x + valueOffsets[valueIndex], rowY + rowHeight * 0.66, valueIndex === 4 ? 48 : 38, {
        font: valueIndex === 5 ? "800 18px Inter, Arial, sans-serif" : "600 17px Inter, Arial, sans-serif",
        fill: valueIndex === 5 ? COLORS.gold : COLORS.muted,
        align: "center",
      });
    });
  });

  if (shownRows.length < group.rows.length) {
    text(ctx, `+${group.rows.length - shownRows.length} игроков`, x + 30, y + height - 26, width - 60, {
      font: "600 18px Inter, Arial, sans-serif",
      fill: COLORS.gold,
    });
  }
}

function drawGroupsPage(ctx: CanvasRenderingContext2D, tournamentTitle: string, groups: ExportGroup[], pageIndex: number, totalPages: number) {
  drawBackground(ctx);
  drawHeader(ctx, tournamentTitle, "Таблицы групп", "4 группы на одном квадратном изображении");

  const marginX = 82;
  const top = 382;
  const gap = 30;
  const cardWidth = (CANVAS_SIZE - marginX * 2 - gap) / 2;
  const cardHeight = 520;

  groups.forEach((group, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    drawGroupCard(ctx, group, marginX + col * (cardWidth + gap), top + row * (cardHeight + gap), cardWidth, cardHeight);
  });

  drawFooter(ctx, `Группы · ${pageIndex + 1}/${totalPages}`);
}

function drawScheduleRow(ctx: CanvasRenderingContext2D, match: ExportScheduleMatch, x: number, y: number, width: number, height: number) {
  fillRound(ctx, x, y, width, height, 16, COLORS.panel);
  strokeRound(ctx, x, y, width, height, 16, "rgba(255,255,255,0.1)", 1.5);

  const badgeSize = 44;
  fillRound(ctx, x + 20, y + 28, badgeSize, badgeSize, 11, "rgba(212,175,55,0.1)");
  strokeRound(ctx, x + 20, y + 28, badgeSize, badgeSize, 11, "rgba(212,175,55,0.28)", 1.5);
  centeredText(ctx, teamMark(match.player1ClubName), x + 42, y + 57, 36, {
    font: "800 14px Inter, Arial, sans-serif",
    fill: COLORS.gold,
  });

  fillRound(ctx, x + width - 64, y + 28, badgeSize, badgeSize, 11, "rgba(212,175,55,0.1)");
  strokeRound(ctx, x + width - 64, y + 28, badgeSize, badgeSize, 11, "rgba(212,175,55,0.28)", 1.5);
  centeredText(ctx, teamMark(match.player2ClubName), x + width - 42, y + 57, 36, {
    font: "800 14px Inter, Arial, sans-serif",
    fill: COLORS.gold,
  });

  if (match.groupName) {
    text(ctx, match.groupName.toUpperCase(), x + 82, y + 25, 230, {
      font: "700 13px Inter, Arial, sans-serif",
      fill: COLORS.goldSoft,
    });
  }

  text(ctx, match.player1ClubName, x + 82, y + 52, 210, {
    font: "800 20px Inter, Arial, sans-serif",
    fill: COLORS.white,
  });
  text(ctx, match.player1Name, x + 82, y + 77, 210, {
    font: "500 15px Inter, Arial, sans-serif",
    fill: COLORS.dim,
  });

  centeredText(ctx, match.scoreLabel, x + width / 2, y + 62, 110, {
    font: "900 24px Inter, Arial, sans-serif",
    fill: COLORS.white,
  });

  text(ctx, match.player2ClubName, x + width - 82, y + 52, 210, {
    font: "800 20px Inter, Arial, sans-serif",
    fill: COLORS.white,
    align: "right",
  });
  text(ctx, match.player2Name, x + width - 82, y + 77, 210, {
    font: "500 15px Inter, Arial, sans-serif",
    fill: COLORS.dim,
    align: "right",
  });
}

function drawSchedulePage(
  ctx: CanvasRenderingContext2D,
  tournamentTitle: string,
  round: ExportScheduleRound,
  matches: ExportScheduleMatch[],
  pageIndex: number,
  totalPages: number,
) {
  drawBackground(ctx);
  drawHeader(ctx, tournamentTitle, round.title, `${matches.length} матчей на этой странице`);

  const marginX = 82;
  const top = 382;
  const gapX = 28;
  const gapY = 18;
  const rowHeight = 92;
  const columnWidth = (CANVAS_SIZE - marginX * 2 - gapX) / 2;

  matches.forEach((match, index) => {
    const column = index >= 12 ? 1 : 0;
    const row = index % 12;
    drawScheduleRow(ctx, match, marginX + column * (columnWidth + gapX), top + row * (rowHeight + gapY), columnWidth, rowHeight);
  });

  drawFooter(ctx, `${round.title} · ${pageIndex + 1}/${totalPages}`);
}

function downloadCanvas(canvas: HTMLCanvasElement, fileName: string) {
  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

function optionButtonClass(active: boolean) {
  return [
    "flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition",
    active
      ? "border-primary/55 bg-primary/10 text-white"
      : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-primary/30 hover:text-white",
  ].join(" ");
}

export function TournamentImageExporter({
  tournamentTitle,
  groups,
  rounds,
}: {
  tournamentTitle: string;
  groups: ExportGroup[];
  rounds: ExportScheduleRound[];
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState(() => groups.map((group) => group.id));
  const [selectedRoundKeys, setSelectedRoundKeys] = useState(() => rounds.map((round) => round.key));
  const [status, setStatus] = useState<string | null>(null);
  const selectedGroups = useMemo(() => groups.filter((group) => selectedGroupIds.includes(group.id)), [groups, selectedGroupIds]);
  const selectedRounds = useMemo(() => rounds.filter((round) => selectedRoundKeys.includes(round.key)), [rounds, selectedRoundKeys]);

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleRound = (key: string) => {
    setSelectedRoundKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  };

  const exportGroups = async () => {
    if (!selectedGroups.length) return;
    setStatus("Готовлю PNG групп...");

    const chunks = chunkArray(selectedGroups, 4);
    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const canvas = createCanvas();
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      drawGroupsPage(ctx, tournamentTitle, chunk, index, chunks.length);
      await downloadCanvas(canvas, `${safeFileName(tournamentTitle)}-groups-${index + 1}.png`);
    }

    setStatus(`Скачано: ${chunks.length} PNG по группам`);
  };

  const exportSchedule = async () => {
    if (!selectedRounds.length) return;
    setStatus("Готовлю PNG расписания...");

    let downloaded = 0;
    for (const round of selectedRounds) {
      const chunks = chunkArray(round.matches, 24);
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const canvas = createCanvas();
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        drawSchedulePage(ctx, tournamentTitle, round, chunk, index, chunks.length);
        await downloadCanvas(canvas, `${safeFileName(tournamentTitle)}-${safeFileName(round.title)}-${index + 1}.png`);
        downloaded += 1;
      }
    }

    setStatus(`Скачано: ${downloaded} PNG по расписанию`);
  };

  return (
    <Card className="overflow-hidden rounded-lg border-primary/15 bg-white/[0.045] p-0">
      <CardHeader className="mb-0 border-b border-white/10 p-4 sm:p-5">
        <CardTitle className="flex items-center gap-2">
          <ImageDown className="h-5 w-5 text-primary" />
          Экспорт PNG
        </CardTitle>
        <CardDescription>Квадратные компактные картинки для публикаций: группы по 4 на фото, расписание по выбранным турам.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 sm:p-5 xl:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-white">
                <Layers3 className="h-4 w-4 text-primary" />
                Группы
              </div>
              <div className="mt-1 text-xs text-zinc-500">В одной PNG помещается до 4 групп.</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedGroupIds(selectedGroupIds.length === groups.length ? [] : groups.map((group) => group.id))}>
              {selectedGroupIds.length === groups.length ? "Снять" : "Все"}
            </Button>
          </div>

          <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {groups.length ? (
              groups.map((group) => {
                const active = selectedGroupIds.includes(group.id);
                const Icon = active ? CheckSquare : Square;

                return (
                  <button key={group.id} type="button" className={optionButtonClass(active)} onClick={() => toggleGroup(group.id)}>
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{group.name}</span>
                      <span className="block text-xs text-zinc-500">{group.rows.length} игроков</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-500">Группы не найдены.</div>
            )}
          </div>

          <Button type="button" variant="outline" className="w-full" disabled={!selectedGroups.length} onClick={exportGroups}>
            <Download className="mr-2 h-4 w-4" />
            Скачать группы PNG
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium text-white">
                <CalendarDays className="h-4 w-4 text-primary" />
                Расписание
              </div>
              <div className="mt-1 text-xs text-zinc-500">Выбери туры, каждый PNG останется квадратным.</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedRoundKeys(selectedRoundKeys.length === rounds.length ? [] : rounds.map((round) => round.key))}>
              {selectedRoundKeys.length === rounds.length ? "Снять" : "Все"}
            </Button>
          </div>

          <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {rounds.length ? (
              rounds.map((round) => {
                const active = selectedRoundKeys.includes(round.key);
                const Icon = active ? CheckSquare : Square;

                return (
                  <button key={round.key} type="button" className={optionButtonClass(active)} onClick={() => toggleRound(round.key)}>
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{round.title}</span>
                      <span className="block text-xs text-zinc-500">{round.matches.length} матчей</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-500">Расписание не найдено.</div>
            )}
          </div>

          <Button type="button" variant="outline" className="w-full" disabled={!selectedRounds.length} onClick={exportSchedule}>
            <Download className="mr-2 h-4 w-4" />
            Скачать расписание PNG
          </Button>
        </div>

        {status ? <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary xl:col-span-2">{status}</div> : null}
      </CardContent>
    </Card>
  );
}
