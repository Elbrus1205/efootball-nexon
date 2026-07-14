export const TELEGRAM_RICH_TEXT_LIMIT = 32_768;
const TELEGRAM_LEGACY_FALLBACK_TEXT_LIMIT = 3_800;
const TELEGRAM_RULES_TEXT_LIMIT = 20_000;

export type TelegramRichBlock =
  | { type: "section_heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "details"; title: string; blocks: TelegramRichBlock[] }
  | { type: "blockquote"; text: string }
  | { type: "photo"; url: string; alt: string }
  | { type: "divider" }
  | { type: "footer"; text: string };

export type TelegramRichMessageDraft = {
  blocks: TelegramRichBlock[];
  fallbackText: string;
  buttons?: Array<{ text: string; url: string; row: number }>;
};

export type TelegramInputRichText =
  | string
  | Array<TelegramInputRichText>
  | { type: "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "code"; text: TelegramInputRichText }
  | { type: "url"; text: TelegramInputRichText; url: string };

export type TelegramInputRichBlock = Record<string, unknown> & { type: string };

export type TelegramInputRichMessage = {
  blocks: TelegramInputRichBlock[];
  skip_entity_detection: boolean;
};

const moscowDateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

function formatMoscowDateTime(value?: Date | null) {
  return value ? `${moscowDateTime.format(value)} МСК` : "Не назначено";
}

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function escapeTelegramHtmlWithin(value: string, limit: number) {
  let result = "";
  for (const character of value) {
    const escaped = escapeTelegramHtml(character);
    if (result.length + escaped.length >= limit) return `${result}…`;
    result += escaped;
  }
  return result;
}

function toTableCells(columns: string[], rows: string[][]) {
  return [
    columns.map((text) => ({ text: truncateText(text, 128), is_header: true })),
    ...rows.map((row) => columns.map((_, index) => ({ text: truncateText(row[index] ?? "", 512) }))),
  ];
}

function toTelegramInputRichBlock(block: TelegramRichBlock): TelegramInputRichBlock {
  if (block.type === "section_heading") {
    return { type: "heading", text: truncateText(block.text, 256), size: 3 };
  }
  if (block.type === "paragraph") {
    return { type: "paragraph", text: truncateText(block.text, 4_096) };
  }
  if (block.type === "table") {
    return {
      type: "table",
      cells: toTableCells(block.columns, block.rows),
      is_bordered: true,
      is_striped: true,
    };
  }
  if (block.type === "details") {
    return {
      type: "details",
      summary: { type: "bold", text: truncateText(block.title, 256) },
      blocks: block.blocks.map(toTelegramInputRichBlock),
      is_open: false,
    };
  }
  if (block.type === "blockquote") {
    return {
      type: "blockquote",
      blocks: [{ type: "paragraph", text: truncateText(block.text, 4_096) }],
    };
  }
  if (block.type === "photo") {
    return {
      type: "photo",
      photo: { type: "photo", media: block.url },
      caption: { text: truncateText(block.alt, 1_024) },
    };
  }
  if (block.type === "footer") {
    return { type: "footer", text: truncateText(block.text, 1_024) };
  }
  return { type: "divider" };
}

export function toTelegramInputRichMessage(message: TelegramRichMessageDraft): TelegramInputRichMessage {
  return {
    blocks: message.blocks.map(toTelegramInputRichBlock),
    skip_entity_detection: false,
  };
}

function rulesBlocks(rules: string): TelegramRichBlock[] {
  const paragraphs = truncateText(rules, TELEGRAM_RULES_TEXT_LIMIT)
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map<TelegramRichBlock>((text) => ({ type: "paragraph", text }));

  return paragraphs.length ? paragraphs : [{ type: "paragraph", text: "Регламент будет опубликован организатором." }];
}

export type TournamentAnnouncementInput = {
  title: string;
  startsAt: Date;
  registrationEndsAt: Date;
  formatLabel: string;
  participantModeLabel: string;
  maxParticipants: number;
  confirmedParticipants: number;
  prizePool?: string | null;
  rules: string;
  coverImage?: string | null;
  tournamentUrl: string;
};

export function buildTournamentAnnouncement(input: TournamentAnnouncementInput): TelegramRichMessageDraft {
  const available = Math.max(0, input.maxParticipants - input.confirmedParticipants);
  const blocks: TelegramRichBlock[] = [];
  const safeTitle = truncateText(input.title, 256);
  const safeRules = truncateText(input.rules, TELEGRAM_RULES_TEXT_LIMIT);

  if (input.coverImage) {
    blocks.push({ type: "photo", url: input.coverImage, alt: `Обложка турнира ${safeTitle}` });
  }

  blocks.push(
    { type: "section_heading", text: safeTitle },
    { type: "paragraph", text: "Регистрация открыта. Собрали ключевую информацию в одном сообщении." },
    {
      type: "table",
      columns: ["Параметр", "Значение"],
      rows: [
        ["Формат", truncateText(input.formatLabel, 256)],
        ["Участники", truncateText(input.participantModeLabel, 256)],
        ["Старт", formatMoscowDateTime(input.startsAt)],
        ["Регистрация до", formatMoscowDateTime(input.registrationEndsAt)],
        ["Занято", `${input.confirmedParticipants} из ${input.maxParticipants}`],
        ["Свободно", String(available)],
        ...(input.prizePool ? [["Призовой фонд", truncateText(input.prizePool, 256)]] : []),
      ],
    },
    { type: "details", title: "Регламент", blocks: rulesBlocks(safeRules) },
    { type: "footer", text: "Проверьте данные профиля и привязку Telegram перед регистрацией." },
  );

  return {
    blocks,
    fallbackText: [
      `<b>${escapeTelegramHtmlWithin(safeTitle, 300)}</b>`,
      "",
      "Регистрация открыта.",
      `<b>Формат:</b> ${escapeTelegramHtmlWithin(input.formatLabel, 300)}`,
      `<b>Старт:</b> ${escapeTelegramHtml(formatMoscowDateTime(input.startsAt))}`,
      `<b>Свободно мест:</b> ${available}`,
      input.prizePool ? `<b>Призовой фонд:</b> ${escapeTelegramHtmlWithin(input.prizePool, 300)}` : "",
      "",
      `<blockquote expandable>${escapeTelegramHtmlWithin(input.rules, TELEGRAM_LEGACY_FALLBACK_TEXT_LIMIT - 1_400)}</blockquote>`,
    ].filter(Boolean).join("\n"),
    buttons: [{ text: "Зарегистрироваться", url: input.tournamentUrl, row: 1 }],
  };
}

export type PersonalMatchMessageInput = {
  tournamentTitle: string;
  stageName: string;
  round: number;
  opponentName: string;
  scheduledAt?: Date | null;
  deadlineAt?: Date | null;
  statusLabel: string;
  matchUrl: string;
};

export function buildPersonalMatchMessage(input: PersonalMatchMessageInput): TelegramRichMessageDraft {
  const rows = [
    ["Турнир", input.tournamentTitle],
    ["Этап", input.stageName],
    ["Тур", String(input.round)],
    ["Соперник", input.opponentName],
    ["Время", formatMoscowDateTime(input.scheduledAt)],
    ["Дедлайн", formatMoscowDateTime(input.deadlineAt)],
    ["Статус", input.statusLabel],
  ];

  return {
    blocks: [
      { type: "section_heading", text: "Ваш матч готов" },
      { type: "table", columns: ["Матч", "Данные"], rows },
      { type: "footer", text: "Отправьте результат до дедлайна и убедитесь, что соперник подтвердил счёт." },
    ],
    fallbackText: [
      "<b>Ваш матч готов</b>",
      "",
      ...rows.map(([label, value]) => `<b>${escapeTelegramHtml(label)}:</b> ${escapeTelegramHtml(value)}`),
    ].join("\n"),
    buttons: [{ text: "Открыть мой матч", url: input.matchUrl, row: 1 }],
  };
}

export function buildStandingsMessage(input: {
  tournamentTitle: string;
  groupName?: string | null;
  rows: Array<{ rank: number; name: string; played: number; goalDifference: number; points: number }>;
  tournamentUrl: string;
  maxRows?: number;
}): TelegramRichMessageDraft {
  const maxRows = Math.max(1, Math.min(input.maxRows ?? 12, 20));
  const visibleRows = input.rows.slice(0, maxRows);
  const hiddenCount = Math.max(0, input.rows.length - visibleRows.length);
  const title = input.groupName ? `${input.tournamentTitle} · ${input.groupName}` : input.tournamentTitle;
  const tableRows = visibleRows.map((row) => [
    String(row.rank),
    row.name,
    String(row.played),
    row.goalDifference > 0 ? `+${row.goalDifference}` : String(row.goalDifference),
    String(row.points),
  ]);

  return {
    blocks: [
      { type: "section_heading", text: title },
      { type: "table", columns: ["#", "Участник", "И", "+/−", "О"], rows: tableRows },
      ...(hiddenCount ? [{ type: "footer" as const, text: `В таблице ещё ${hiddenCount} участников — откройте полную версию.` }] : []),
    ],
    fallbackText: [
      `<b>${escapeTelegramHtml(title)}</b>`,
      "",
      ...tableRows.map((row) => `${row[0]}. ${escapeTelegramHtml(row[1])} · И ${row[2]} · +/- ${row[3]} · <b>${row[4]} очк.</b>`),
      hiddenCount ? `\nЕщё ${hiddenCount} участников — в полной таблице.` : "",
    ].filter(Boolean).join("\n"),
    buttons: [{ text: "Полная таблица", url: input.tournamentUrl, row: 1 }],
  };
}

export function buildScheduleMessage(input: {
  tournamentTitle: string;
  stageName?: string | null;
  matches: Array<{
    round: number;
    playerOne: string;
    playerTwo: string;
    scheduledAt?: Date | null;
    statusLabel: string;
  }>;
  tournamentUrl: string;
  maxRows?: number;
}): TelegramRichMessageDraft {
  const maxRows = Math.max(1, Math.min(input.maxRows ?? 12, 20));
  const visibleMatches = input.matches.slice(0, maxRows);
  const hiddenCount = Math.max(0, input.matches.length - visibleMatches.length);
  const title = input.stageName ? `${input.tournamentTitle} · ${input.stageName}` : input.tournamentTitle;
  const rows = visibleMatches.map((match) => [
    String(match.round),
    `${match.playerOne} — ${match.playerTwo}`,
    formatMoscowDateTime(match.scheduledAt),
    match.statusLabel,
  ]);

  return {
    blocks: [
      { type: "section_heading", text: `Расписание · ${title}` },
      { type: "table", columns: ["Тур", "Матч", "Время", "Статус"], rows },
      ...(hiddenCount ? [{ type: "footer" as const, text: `Ещё ${hiddenCount} матчей доступны на странице турнира.` }] : []),
    ],
    fallbackText: [
      `<b>Расписание · ${escapeTelegramHtml(title)}</b>`,
      "",
      ...rows.map((row) => `<b>Тур ${row[0]}</b> · ${escapeTelegramHtml(row[1])}\n${escapeTelegramHtml(row[2])} · ${escapeTelegramHtml(row[3])}`),
      hiddenCount ? `\nЕщё ${hiddenCount} матчей — на сайте.` : "",
    ].filter(Boolean).join("\n\n"),
    buttons: [{ text: "Открыть расписание", url: input.tournamentUrl, row: 1 }],
  };
}

export function buildResultMessage(input: {
  tournamentTitle: string;
  stageName?: string | null;
  round: number;
  playerOne: string;
  playerTwo: string;
  playerOneScore: number;
  playerTwoScore: number;
  penaltyScore?: string | null;
  winnerName?: string | null;
  coverImage?: string | null;
  tournamentUrl: string;
}): TelegramRichMessageDraft {
  const score = `${input.playerOneScore}:${input.playerTwoScore}${input.penaltyScore ? ` (${input.penaltyScore} пен.)` : ""}`;
  const blocks: TelegramRichBlock[] = [];
  if (input.coverImage) blocks.push({ type: "photo", url: input.coverImage, alt: `Итог матча ${input.tournamentTitle}` });
  blocks.push(
    { type: "section_heading", text: "Матч завершён" },
    {
      type: "table",
      columns: ["Поле", "Результат"],
      rows: [
        ["Турнир", input.tournamentTitle],
        ["Этап", input.stageName || "Основной этап"],
        ["Тур", String(input.round)],
        ["Матч", `${input.playerOne} — ${input.playerTwo}`],
        ["Счёт", score],
        ["Победитель", input.winnerName || "Ничья"],
      ],
    },
    { type: "footer", text: "Таблица и сетка уже пересчитаны на платформе." },
  );

  return {
    blocks,
    fallbackText: [
      "<b>Матч завершён</b>",
      `<b>${escapeTelegramHtml(input.tournamentTitle)}</b>`,
      "",
      `${escapeTelegramHtml(input.playerOne)} — ${escapeTelegramHtml(input.playerTwo)}`,
      `<b>Счёт: ${escapeTelegramHtml(score)}</b>`,
      `<b>Победитель:</b> ${escapeTelegramHtml(input.winnerName || "Ничья")}`,
    ].join("\n"),
    buttons: [{ text: "Таблица и сетка", url: input.tournamentUrl, row: 1 }],
  };
}

export function buildCompletionMessage(input: {
  tournamentTitle: string;
  winnerName?: string | null;
  participantsCount: number;
  matchesCount: number;
  coverImage?: string | null;
  tournamentUrl: string;
}): TelegramRichMessageDraft {
  const blocks: TelegramRichBlock[] = [];
  if (input.coverImage) blocks.push({ type: "photo", url: input.coverImage, alt: `Итоги ${input.tournamentTitle}` });
  blocks.push(
    { type: "section_heading", text: `${input.tournamentTitle} завершён` },
    {
      type: "table",
      columns: ["Итоги", "Значение"],
      rows: [
        ["Победитель", input.winnerName || "Не определён"],
        ["Участников", String(input.participantsCount)],
        ["Сыграно матчей", String(input.matchesCount)],
      ],
    },
    { type: "blockquote", text: input.winnerName ? `Поздравляем ${input.winnerName} с чемпионством!` : "Спасибо всем участникам турнира!" },
  );

  return {
    blocks,
    fallbackText: [
      `<b>${escapeTelegramHtml(input.tournamentTitle)} завершён</b>`,
      "",
      `<b>Победитель:</b> ${escapeTelegramHtml(input.winnerName || "Не определён")}`,
      `<b>Участников:</b> ${input.participantsCount}`,
      `<b>Сыграно матчей:</b> ${input.matchesCount}`,
    ].join("\n"),
    buttons: [{ text: "Посмотреть итоги", url: input.tournamentUrl, row: 1 }],
  };
}

export function buildNotificationRichMessage(input: {
  title: string;
  body: string;
  typeLabel: string;
  url?: string | null;
  buttonText?: string | null;
}): TelegramRichMessageDraft {
  return {
    blocks: [
      { type: "section_heading", text: input.title },
      { type: "blockquote", text: input.body },
      { type: "footer", text: `eFootball Nexon · ${input.typeLabel}` },
    ],
    fallbackText: [
      "<b>eFootball Nexon</b>",
      `<b>${escapeTelegramHtml(input.title)}</b>`,
      `<blockquote>${escapeTelegramHtml(input.body)}</blockquote>`,
      `<i>${escapeTelegramHtml(input.typeLabel)}</i>`,
    ].join("\n\n"),
    buttons: input.url && input.buttonText ? [{ text: input.buttonText, url: input.url, row: 1 }] : undefined,
  };
}
