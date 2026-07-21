import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TELEGRAM_RICH_TEXT_LIMIT,
  buildNotificationRichMessage,
  buildPersonalMatchMessage,
  buildResultMessage,
  buildScheduleMessage,
  buildStandingsMessage,
  buildTournamentAnnouncement,
  toTelegramInputRichMessage,
} from "@/lib/telegram-rich";

describe("Telegram rich tournament messages", () => {
  it("uses the Bot API rich-message limit", () => {
    assert.equal(TELEGRAM_RICH_TEXT_LIMIT, 32_768);
  });

  it("builds an announcement with media, facts, rules and registration CTA", () => {
    const message = buildTournamentAnnouncement({
      title: "Nexon Champions <Cup>",
      startsAt: new Date("2026-07-20T17:00:00.000Z"),
      registrationEndsAt: new Date("2026-07-19T17:00:00.000Z"),
      formatLabel: "Группы + плей-офф",
      participantModeLabel: "1x1",
      maxParticipants: 32,
      confirmedParticipants: 12,
      prizePool: "10 000 ₽",
      rules: "Честная игра\nБез оскорблений",
      coverImage: "https://cdn.example/tournament.webp",
      tournamentUrl: "https://nexon.example/tournaments/cup",
    });

    assert.equal(message.blocks[0]?.type, "photo");
    assert.ok(message.blocks.some((block) => block.type === "section_heading" && block.text.includes("Nexon Champions <Cup>")));
    const facts = message.blocks.find((block) => block.type === "table");
    assert.ok(facts && facts.type === "table");
    assert.deepEqual(facts.columns, ["Параметр", "Значение"]);
    assert.ok(facts.rows.some((row) => row[0] === "Свободно" && row[1] === "20"));
    assert.ok(message.blocks.some((block) => block.type === "details" && block.title === "Регламент"));
    assert.deepEqual(message.buttons, [{ text: "Принять участие", url: "https://nexon.example/tournaments/cup", row: 1 }]);
    assert.match(message.fallbackText, /Nexon Champions &lt;Cup&gt;/);
    assert.match(message.fallbackText, /<tg-emoji emoji-id="\d+">/);
  });

  it("keeps very long rules within rich and legacy delivery limits", () => {
    const message = buildTournamentAnnouncement({
      title: "Nexon Marathon",
      startsAt: new Date("2026-07-20T17:00:00.000Z"),
      registrationEndsAt: new Date("2026-07-19T17:00:00.000Z"),
      formatLabel: "Лига",
      participantModeLabel: "1x1",
      maxParticipants: 32,
      confirmedParticipants: 12,
      rules: "Правила <турнира> & fair play. ".repeat(4_000),
      tournamentUrl: "https://nexon.example/tournaments/marathon",
    });
    const payload = toTelegramInputRichMessage(message);
    const richTextLength = JSON.stringify(payload).match(/"text":"([^"]*)"/g)?.join("").length ?? 0;

    assert.ok(richTextLength < TELEGRAM_RICH_TEXT_LIMIT);
    assert.ok(message.fallbackText.length <= 3_800);
    assert.match(message.fallbackText, /…/);
    assert.match(message.fallbackText, /&lt;турнира&gt; &amp; fair play/);
    assert.doesNotMatch(message.fallbackText, /<blockquote/);
  });

  it("builds a compact personal match card with an actionable link", () => {
    const message = buildPersonalMatchMessage({
      tournamentTitle: "Nexon Cup",
      stageName: "Группа A",
      round: 3,
      opponentName: "Player 2",
      scheduledAt: new Date("2026-07-16T16:30:00.000Z"),
      deadlineAt: new Date("2026-07-16T19:00:00.000Z"),
      statusLabel: "Ожидается результат",
      matchUrl: "https://nexon.example/tournaments/cup?tab=my-matches",
    });

    const table = message.blocks.find((block) => block.type === "table");
    assert.ok(table && table.type === "table");
    assert.ok(table.rows.some((row) => row[0] === "Соперник" && row[1] === "Player 2"));
    assert.ok(table.rows.some((row) => row[0] === "Дедлайн" && row[1].includes("16 июл")));
    assert.equal(message.buttons?.[0]?.text, "Перейти к матчу");
    assert.match(message.fallbackText, /<tg-emoji emoji-id="\d+">/);
  });

  it("caps long standings while explaining where to see the rest", () => {
    const message = buildStandingsMessage({
      tournamentTitle: "Nexon League",
      groupName: "Группа A",
      rows: Array.from({ length: 18 }, (_, index) => ({
        rank: index + 1,
        name: `Player ${index + 1}`,
        played: 5,
        goalDifference: 10 - index,
        points: 15 - index,
      })),
      tournamentUrl: "https://nexon.example/tournaments/league",
      maxRows: 12,
    });

    const table = message.blocks.find((block) => block.type === "table");
    assert.ok(table && table.type === "table");
    assert.equal(table.rows.length, 12);
    assert.ok(message.blocks.some((block) => block.type === "footer" && block.text.includes("ещё 6")));
    assert.equal(message.buttons?.[0]?.text, "Открыть таблицу");
  });

  it("maps domain blocks to the Bot API 10.2 input shape", () => {
    const payload = toTelegramInputRichMessage({
      fallbackText: "Таблица",
      blocks: [
        { type: "section_heading", text: "Группа A" },
        { type: "table", columns: ["#", "Игрок"], rows: [["1", "Alpha"]] },
        { type: "details", title: "Правила", blocks: [{ type: "paragraph", text: "Fair play" }] },
        { type: "photo", url: "https://cdn.example/cover.webp", alt: "Обложка" },
      ],
    });

    assert.deepEqual(payload.blocks[0], { type: "heading", text: "Группа A", size: 3 });
    assert.deepEqual(payload.blocks[1], {
      type: "table",
      cells: [
        [{ text: "#", is_header: true }, { text: "Игрок", is_header: true }],
        [{ text: "1" }, { text: "Alpha" }],
      ],
      is_bordered: true,
      is_striped: true,
    });
    assert.deepEqual(payload.blocks[2], {
      type: "details",
      summary: { type: "bold", text: "Правила" },
      blocks: [{ type: "paragraph", text: "Fair play" }],
      is_open: false,
    });
    assert.deepEqual(payload.blocks[3], {
      type: "photo",
      photo: { type: "photo", media: "https://cdn.example/cover.webp" },
      caption: { text: "Обложка" },
    });
  });

  it("builds readable schedule and result cards", () => {
    const schedule = buildScheduleMessage({
      tournamentTitle: "Nexon Cup",
      stageName: "Плей-офф",
      matches: [{
        round: 1,
        playerOne: "Alpha",
        playerTwo: "Beta",
        scheduledAt: new Date("2026-07-18T17:00:00.000Z"),
        statusLabel: "Запланирован",
      }],
      tournamentUrl: "https://nexon.example/tournaments/cup?tab=matches",
    });
    const scheduleTable = schedule.blocks.find((block) => block.type === "table");
    assert.ok(scheduleTable && scheduleTable.type === "table");
    assert.deepEqual(scheduleTable.rows[0].slice(0, 2), ["1", "Alpha — Beta"]);

    const result = buildResultMessage({
      tournamentTitle: "Nexon Cup",
      stageName: "Финал",
      round: 4,
      playerOne: "Alpha",
      playerTwo: "Beta",
      playerOneScore: 3,
      playerTwoScore: 2,
      winnerName: "Alpha",
      coverImage: "https://cdn.example/cup.webp",
      tournamentUrl: "https://nexon.example/tournaments/cup",
    });
    assert.equal(result.blocks[0]?.type, "photo");
    const resultTable = result.blocks.find((block) => block.type === "table");
    assert.ok(resultTable && resultTable.type === "table");
    assert.ok(resultTable.rows.some((row) => row[0] === "Счёт" && row[1] === "3:2"));
    assert.match(result.fallbackText, /Победитель:<\/b> Alpha/);
  });

  it("builds a plain premium-emoji notification without a system footer", () => {
    const message = buildNotificationRichMessage({
      title: "Регламент обновлён",
      body: "Посмотрите изменения и подтвердите новую версию.",
      typeLabel: "Системное уведомление",
      url: "https://nexon.example/regulations",
      buttonText: "Посмотреть изменения",
    });

    assert.match(message.fallbackText, /^<tg-emoji emoji-id="\d+">/);
    assert.match(message.fallbackText, /<b>Регламент обновлён<\/b>/);
    assert.doesNotMatch(message.fallbackText, /blockquote|Системное уведомление|eFootball Nexon/);
    assert.deepEqual(message.buttons, [{
      text: "Посмотреть изменения",
      url: "https://nexon.example/regulations",
      row: 1,
    }]);
  });
});
