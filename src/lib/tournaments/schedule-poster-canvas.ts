import { scheduleDeadlineLabel, scheduleMatchCountLabel, schedulePosterLayout, type ExportScheduleRound, type SchedulePosterFixture } from "@/lib/tournaments/schedule-poster";

const palette = { background: "#101112", surface: "#191b1d", border: "#323436", text: "#f3f1ec", muted: "#b0b2b4", gold: "#c8b58b" };

function loadBadge(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (result: HTMLImageElement | null) => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };
    const timeout = setTimeout(() => { finish(null); image.src = ""; }, 12000);
    image.crossOrigin = "anonymous";
    image.onload = () => finish(image.naturalWidth && image.naturalHeight ? image : null);
    image.onerror = () => finish(null);
    image.src = src;
  });
}

async function loadBadges(matches: SchedulePosterFixture[]) {
  const paths = [...new Set(matches.flatMap((match) => [match.player1ClubBadgePath, match.player2ClubBadgePath]).filter((path): path is string => Boolean(path)))];
  const badges = new Map<string, HTMLImageElement | null>();
  // Bound concurrent requests even when a large selection is downloaded.
  const load = async (pending: string[]) => {
    let index = 0;
    await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (index < pending.length) {
        const path = pending[index++];
        badges.set(path, await loadBadge(path));
      }
    }));
  };
  await load(paths);
  // A download can start while the tournament page is still loading its images.
  // Retry missing badges after the initial queue has cleared.
  await load(paths.filter((path) => !badges.get(path)));
  return badges;
}

export async function renderSchedulePoster(round: ExportScheduleRound, matches: SchedulePosterFixture[], totalMatchCount: number) {
  if (!matches.length) throw new Error("В выбранном туре нет матчей для изображения.");
  await document.fonts.ready;
  const badges = await loadBadges(matches);
  const layout = schedulePosterLayout(matches.length);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Браузер не смог создать изображение. Попробуйте скачать его ещё раз.");
  const font = getComputedStyle(document.body).fontFamily || "Arial, sans-serif";
  const label = (value: string, x: number, y: number, width: number, size: number, color = palette.text, align: CanvasTextAlign = "left", weight = 700) => {
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    const minimum = size * 0.8;
    while (ctx.measureText(value).width > width && size > minimum) ctx.font = `${weight} ${--size}px ${font}`;
    const chars = Array.from(value);
    if (ctx.measureText(value).width > width) {
      while (chars.length && ctx.measureText(`${chars.join("")}…`).width > width) chars.pop();
      value = `${chars.join("")}…`;
    }
    ctx.fillText(value, x, y);
  };
  const badge = (src: string | null | undefined, club: string, x: number, y: number, size: number) => {
    const image = src ? badges.get(src) : null;
    if (image) {
      const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      ctx.drawImage(image, x + (size - w) / 2, y + (size - h) / 2, w, h);
    } else {
      ctx.strokeStyle = palette.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, 14);
      ctx.stroke();
      const initials = club.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => Array.from(word)[0]).join("").toUpperCase();
      label(initials || "—", x + size / 2, y + size * 0.64, size - 12, size * 0.34, palette.gold, "center");
    }
  };
  const clubLabel = (value: string, x: number, y: number, width: number, align: CanvasTextAlign) => {
    ctx.font = `700 29px ${font}`;
    if (ctx.measureText(value).width <= width) { label(value, x, y, width, 29, palette.text, align); return; }
    const words = value.split(/\s+/);
    let split = 1;
    let best = Infinity;
    for (let i = 1; i < words.length; i++) {
      const score = Math.max(ctx.measureText(words.slice(0, i).join(" ")).width, ctx.measureText(words.slice(i).join(" ")).width);
      if (score < best) { best = score; split = i; }
    }
    if (words.length === 1) { label(value, x, y, width, 29, palette.text, align); return; }
    label(words.slice(0, split).join(" "), x, y - 16, width, 29, palette.text, align);
    label(words.slice(split).join(" "), x, y + 18, width, 29, palette.text, align);
  };

  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, layout.width, layout.height);
  const light = ctx.createLinearGradient(0, 0, layout.width, layout.height);
  light.addColorStop(0, "rgba(200,181,139,0.07)");
  light.addColorStop(0.55, "rgba(200,181,139,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(64, 57, 48, 4);
  label(round.title, 64, 145, layout.width - 128, 70);
  ctx.fillStyle = palette.border;
  ctx.fillRect(64, 184, layout.width - 128, 1);
  label("ДЕДЛАЙН", 64, 218, 200, 18, palette.gold);
  label(scheduleDeadlineLabel(round.deadlineAt), 64, 253, 1030, 29, palette.text, "left", 400);
  label(scheduleMatchCountLabel(totalMatchCount), layout.width - 64, 248, 340, 30, palette.gold, "right");

  matches.forEach((match, index) => {
    const { x, y, width, height } = layout.slots[index];
    const wide = layout.columns === 1;
    ctx.fillStyle = palette.surface;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 20);
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    if (matches.length === 1) {
      const left = x + width * 0.25;
      const right = x + width * 0.75;
      badge(match.player1ClubBadgePath, match.player1ClubName, left - 95, y + 78, 190);
      badge(match.player2ClubBadgePath, match.player2ClubName, right - 95, y + 78, 190);
      label(match.player1ClubName, left, y + 358, width * 0.42, 52, palette.text, "center");
      label(match.player2ClubName, right, y + 358, width * 0.42, 52, palette.text, "center");
      label(match.player1Name, left, y + 416, width * 0.42, 36, palette.muted, "center", 400);
      label(match.player2Name, right, y + 416, width * 0.42, 36, palette.muted, "center", 400);
      label("VS", x + width / 2, y + 200, 100, 38, palette.gold, "center");
      if (match.matchCount > 1) label(`×${match.matchCount}`, x + width / 2, y + 245, 100, 26, palette.muted, "center", 400);
      return;
    }
    const contentY = y + (wide ? (height - 148) / 2 : 0);
    const emblemSize = wide ? 76 : 56;
    const inset = 24;
    const emblemY = contentY + (wide ? 36 : 25);
    badge(match.player1ClubBadgePath, match.player1ClubName, x + inset, emblemY, emblemSize);
    badge(match.player2ClubBadgePath, match.player2ClubName, x + width - inset - emblemSize, emblemY, emblemSize);
    const nameInset = inset + emblemSize + 20;
    const clubWidth = width / 2 - nameInset - 50;
    if (wide) {
      label(match.player1ClubName, x + nameInset, contentY + 67, clubWidth, 37);
      label(match.player2ClubName, x + width - nameInset, contentY + 67, clubWidth, 37, palette.text, "right");
    } else {
      clubLabel(match.player1ClubName, x + nameInset, y + 62, clubWidth, "left");
      clubLabel(match.player2ClubName, x + width - nameInset, y + 62, clubWidth, "right");
    }
    const nicknameInset = wide ? nameInset : inset;
    const nicknameWidth = width / 2 - nicknameInset - 48;
    label(match.player1Name, x + nicknameInset, contentY + (wide ? 105 : 132), nicknameWidth, wide ? 29 : 27, palette.muted, "left", 400);
    label(match.player2Name, x + width - nicknameInset, contentY + (wide ? 105 : 132), nicknameWidth, wide ? 29 : 27, palette.muted, "right", 400);
    label("VS", x + width / 2, contentY + (wide ? 75 : 65), 64, 24, palette.gold, "center");
    if (match.matchCount > 1) label(`×${match.matchCount}`, x + width / 2, contentY + (wide ? 104 : 105), 72, 20, palette.muted, "center", 400);
  });
  return canvas;
}
