import assert from "node:assert/strict";
import test from "node:test";
import { buildTelegramAutoReply, handleTelegramAutoReply } from "@/lib/services/telegram-auto-replies";
import { tgEmoji } from "@/lib/telegram-emoji";

test("a misspelled tournament registration question gets a personal answer", () => {
  const reply = buildTelegramAutoReply({
    text: "подскажите пж как регаться в трнир?",
    firstName: "Илья",
  });

  assert.deepEqual(reply, {
    intent: "tournament-registration",
    text: `${tgEmoji("gamepad")} <b>Илья</b>, всё просто: откройте раздел «Турниры», выберите подходящий с открытой регистрацией и нажмите «Участвовать». Заполните заявку и подтвердите её — статус будет виден на странице турнира.`,
    button: { text: "Открыть турниры", path: "/tournaments" },
  });
});

test("common chat slang and typos still resolve to the intended answer", () => {
  const cases = [
    ["кк зарегатся на турик", "tournament-registration"],
    ["где россписание игр", "tournament-schedule"],
    ["саперник не атвечает", "opponent-unresponsive"],
    ["как атправить ресультат", "match-result"],
    ["где праила турнра", "tournament-rules"],
  ] as const;

  for (const [text, intent] of cases) {
    assert.equal(buildTelegramAutoReply({ text, firstName: "Омар" })?.intent, intent, text);
  }
});

test("account access questions resolve to the right self-service action", () => {
  const cases = [
    ["как создать аккаунт на сайте", "account-registration", "/register"],
    ["почему я не могу войти в аккаунт", "account-login", "/login"],
    ["забыл пароль как восстановить", "password-recovery", "/forgot-password"],
    ["как привязать телегу к профилю", "telegram-link", "/dashboard/security"],
  ] as const;

  for (const [text, intent, path] of cases) {
    const reply = buildTelegramAutoReply({ text, firstName: "Амина" });
    assert.equal(reply?.intent, intent, text);
    assert.equal(reply?.button?.path, path, text);
    assert.match(reply?.text ?? "", /<b>Амина<\/b>/, text);
  }
});

test("tournament information questions resolve to the relevant section", () => {
  const cases = [
    ["где найти актуальные турниры", "tournament-list"],
    ["когда уже начнется турнир", "tournament-start"],
    ["где смотреть расписание матчей", "tournament-schedule"],
    ["скиньте правила турнира", "tournament-rules"],
    ["где турнирная таблица и очки", "tournament-standings"],
    ["как посмотреть сетку плей офф", "tournament-bracket"],
    ["какие будут призы за турнир", "tournament-prizes"],
  ] as const;

  for (const [text, intent] of cases) {
    const reply = buildTelegramAutoReply({ text, firstName: "Марат" });
    assert.equal(reply?.intent, intent, text);
    assert.equal(reply?.button?.path, "/tournaments", text);
  }
});

test("match questions explain the correct next action", () => {
  const cases = [
    ["где мой матч с соперником", "my-match", "/dashboard/matches"],
    ["как отправить результат матча", "match-result", "/dashboard/matches"],
    ["мы ввели разный счет что теперь делать", "match-dispute", "/dashboard/matches"],
    ["соперник вообще не отвечает", "opponent-unresponsive", "/dashboard/matches"],
    ["когда дедлайн моего матча", "match-deadline", "/dashboard/matches"],
    ["как можно перенести матч", "match-reschedule", "/dashboard/matches"],
    ["нужен ли скрин результата", "result-proof", "/tournaments"],
    ["как считать пенальти в матче", "match-penalties", "/tournaments"],
  ] as const;

  for (const [text, intent, path] of cases) {
    const reply = buildTelegramAutoReply({ text, firstName: "Саид" });
    assert.equal(reply?.intent, intent, text);
    assert.equal(reply?.button?.path, path, text);
  }
});

test("registration and roster problems receive actionable answers", () => {
  const cases = [
    ["как зарегистрировать команду 2 на 2", "team-registration"],
    ["как пригласить второго игрока в состав", "roster-invite"],
    ["как принять приглашение в команду", "roster-invite"],
    ["можно сменить клуб после заявки", "club-change"],
    ["почему моя заявка все еще на проверке", "application-pending"],
    ["почему отклонили мою заявку", "application-rejected"],
    ["регистрация недоступна из за надежности", "reliability-restriction"],
    ["как отменить регистрацию в турнире", "registration-cancel"],
    ["как правильно сделать фото состава", "lineup-photo"],
  ] as const;

  for (const [text, intent] of cases) {
    const reply = buildTelegramAutoReply({ text, firstName: "Рустам" });
    assert.equal(reply?.intent, intent, text);
    assert.ok(reply?.button, text);
  }
});

test("general platform questions cover help, profile and support", () => {
  const cases = [
    ["/help", "bot-help", "/faq"],
    ["что вообще умеет этот бот", "bot-help", "/faq"],
    ["как изменить имя и аватар", "profile-edit", "/dashboard/edit"],
    ["мне не приходят уведомления", "notifications", "/dashboard/security"],
    ["как связаться с админом", "support", "/contacts"],
    ["где посмотреть мой рейтинг", "ratings", "/ratings"],
    ["как получить достижение", "achievements", "/dashboard/achievements"],
    ["что такое надежность", "reliability", "/faq"],
    ["что за монеты и где они", "coins", "/coins"],
    ["как удалить аккаунт", "account-deletion", "/dashboard/privacy"],
    ["меня забанили что делать", "account-restriction", "/contacts"],
  ] as const;

  for (const [text, intent, path] of cases) {
    const reply = buildTelegramAutoReply({ text, firstName: "Лейла" });
    assert.equal(reply?.intent, intent, text);
    assert.equal(reply?.button?.path, path, text);
  }
});

test("ordinary conversation and match chatter do not trigger the bot", () => {
  assert.equal(buildTelegramAutoReply({ text: "привет как дела", firstName: "Адам" }), null);
  assert.equal(buildTelegramAutoReply({ text: "Барса победила 2:1, отличный матч", firstName: "Адам" }), null);
});

test("a Telegram display name cannot inject HTML into a reply", () => {
  const reply = buildTelegramAutoReply({ text: "как регаться в турнир", firstName: "<Admin>" });
  assert.match(reply?.text ?? "", /<b>&lt;Admin&gt;<\/b>/);
});

test("a group question is answered in the same comment thread and replies to the author message", async () => {
  let sent: unknown;
  const result = await handleTelegramAutoReply(
    {
      message_id: 731,
      message_thread_id: 44,
      from: { id: 91, first_name: "Зарина", is_bot: false },
      chat: { id: -100123, type: "supergroup" },
      text: "подскажите как отправить счет матча",
    },
    {
      siteBaseUrl: "https://nexon.example",
      send: async (params) => {
        sent = params;
        return {};
      },
    },
  );

  assert.deepEqual(result, { handled: true, intent: "match-result" });
  assert.deepEqual(sent, {
    chatId: "-100123",
    text: `${tgEmoji("check")} <b>Зарина</b>, откройте матч во вкладке «Мои матчи», введите счёт и при необходимости пенальти. Матч подтвердится автоматически, когда оба участника пришлют совпадающие данные.`,
    disableWebPagePreview: true,
    replyParameters: { messageId: 731, allowSendingWithoutReply: true },
    messageThreadId: 44,
    replyMarkup: {
      inline_keyboard: [[{ text: "Открыть мои матчи", url: "https://nexon.example/dashboard/matches" }]],
    },
  });
});

test("the auto responder ignores bots, forwarded channel posts and ordinary chatter", async () => {
  let sends = 0;
  const send = async () => {
    sends += 1;
    return {};
  };
  const base = { message_id: 1, chat: { id: -100123, type: "supergroup" as const } };

  assert.deepEqual(
    await handleTelegramAutoReply({ ...base, from: { id: 2, first_name: "Bot", is_bot: true }, text: "как регаться в турнир" }, { send }),
    { handled: false },
  );
  assert.deepEqual(
    await handleTelegramAutoReply({ ...base, is_automatic_forward: true, text: "как регаться в турнир" }, { send }),
    { handled: false },
  );
  assert.deepEqual(
    await handleTelegramAutoReply({ ...base, from: { id: 3, first_name: "Али" }, text: "Барса выиграла 2:1" }, { send }),
    { handled: false },
  );
  assert.equal(sends, 0);
});
