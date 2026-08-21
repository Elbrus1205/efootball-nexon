import assert from "node:assert/strict";
import test from "node:test";
import { tgEmojiId } from "@/lib/telegram-emoji";
import {
  TELEGRAM_AI_SYSTEM_PROMPT,
  askWillow,
  handleTelegramAiMessage,
  isTelegramAiRelevantMessage,
  type TelegramAiContext,
} from "@/lib/services/telegram-ai";

const context: TelegramAiContext = {
  user: { name: "Илья", telegramUsername: "ilya" },
  tournament: {
    id: "tournament-1",
    title: "Весенний кубок",
    rules: "Матчи до 20:00 по Москве.",
    status: "REGISTRATION_OPEN",
    startsAt: "2026-08-24T16:00:00.000Z",
    registrationStartsAt: "2026-08-20T16:00:00.000Z",
    registrationEndsAt: "2026-08-23T16:00:00.000Z",
  },
  upcomingTournaments: [
    {
      id: "tournament-1",
      title: "Весенний кубок",
      status: "REGISTRATION_OPEN",
      startsAt: "2026-08-24T16:00:00.000Z",
      registrationEndsAt: "2026-08-23T16:00:00.000Z",
    },
  ],
  personalMatch: {
    id: "match-1",
    tournamentId: "tournament-1",
    tournamentTitle: "Весенний кубок",
    stage: "Группа A",
    round: 2,
    opponent: "@opponent",
    status: "SCHEDULED",
    scheduledAt: "2026-08-22T16:00:00.000Z",
    deadlineAt: "2026-08-23T17:00:00.000Z",
  },
};

test("Willow request uses bearer auth and includes live context in the system prompt", async () => {
  process.env.WILLOW_API_TOKEN = "test-token";
  let request: RequestInit | undefined;
  const answer = await askWillow({
    text: "С кем я играю?",
    context,
    fetchImpl: async (_input, init) => {
      request = init;
      return new Response(JSON.stringify({ choices: [{ message: { content: "Ваш соперник: @opponent." } }] }), { status: 200 });
    },
  });

  assert.equal(answer, "Ваш соперник: @opponent.");
  assert.equal((request?.headers as Record<string, string>).Authorization, "Bearer test-token");
  const body = JSON.parse(String(request?.body)) as { messages: Array<{ role: string; content: string }> };
  assert.equal(body.messages[0]?.role, "system");
  assert.match(body.messages[0]?.content ?? "", /Весенний кубок/);
  assert.match(body.messages[0]?.content ?? "", /только по eFootball Nexon/);
  assert.equal(body.messages[1]?.content, "С кем я играю?");
});

test("group chatter is gated while tournament questions are eligible", () => {
  assert.equal(isTelegramAiRelevantMessage({ chat: { type: "supergroup" }, text: "Кто сегодня играет?" }, "nexon_bot"), true);
  assert.equal(isTelegramAiRelevantMessage({ chat: { type: "supergroup" }, text: "Как дела?" }, "nexon_bot"), false);
  assert.equal(isTelegramAiRelevantMessage({ chat: { type: "supergroup" }, text: "@nexon_bot привет" }, "nexon_bot"), true);
});

test("AI reply keeps the message thread and author reply", async () => {
  process.env.WILLOW_API_TOKEN = "test-token";
  process.env.NEXT_PUBLIC_APP_URL = "https://nexon.example";
  const sent: Array<Record<string, unknown>> = [];
  const result = await handleTelegramAiMessage({
    message: {
      message_id: 42,
      message_thread_id: 7,
      chat: { id: -100, type: "supergroup" },
      from: { id: 9, is_bot: false },
      text: "Как отправить результат матча?",
    },
    context,
    ask: async () => "Откройте матч на сайте и отправьте счёт.",
    send: async (params) => { sent.push(params as unknown as Record<string, unknown>); return {}; },
  });

  assert.equal(result.handled, true);
  assert.equal(sent[0]?.chatId, "-100");
  assert.deepEqual(sent[0]?.replyParameters, { messageId: 42, allowSendingWithoutReply: true });
  assert.equal(sent[0]?.messageThreadId, 7);
  assert.equal(sent[0]?.parseMode, null);
  assert.deepEqual(sent[0]?.replyMarkup, {
    inline_keyboard: [
      [{ text: "Мой матч", url: "https://nexon.example/tournaments/tournament-1?tab=my-matches", icon_custom_emoji_id: tgEmojiId("arrowRight") }],
      [
        { text: "Открыть турнир", url: "https://nexon.example/tournaments/tournament-1", icon_custom_emoji_id: tgEmojiId("arrowRight") },
        { text: "Регламент", url: "https://nexon.example/tournaments/tournament-1?tab=rules", icon_custom_emoji_id: tgEmojiId("arrowRight") },
      ],
    ],
  });
});

test("system prompt rejects unrelated topics and forbids invented facts", () => {
  assert.match(TELEGRAM_AI_SYSTEM_PROMPT, /только по eFootball Nexon/);
  assert.match(TELEGRAM_AI_SYSTEM_PROMPT, /Не выдумывай даты/);
  assert.match(TELEGRAM_AI_SYSTEM_PROMPT, /тестовые турниры/);
});
