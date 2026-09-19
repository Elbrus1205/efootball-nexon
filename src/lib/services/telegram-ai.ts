import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { sendTelegramMessage, type TelegramInlineKeyboardMarkup, type TelegramSentMessage } from "@/lib/telegram-bot";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { z } from "zod";

export const TELEGRAM_AI_NAME = "Роки";

export const TELEGRAM_AI_SYSTEM_PROMPT = `Ты ${TELEGRAM_AI_NAME}, официальный турнирный помощник и нейтральный судья платформы eFootball Nexon в Telegram.

Твоя задача — понять смысл сообщения, а не требовать специальную команду. Отвечай только по eFootball Nexon и связанным турнирам, но на обычные сообщения о платформе и турнирах отвечай без /ask. Команда /ask нужна для явного вопроса и позволяет спросить о любой опубликованной функции сайта, FAQ, регламенте или турнире. Отвечай о сайте и аккаунте, регистрации, входе, профиле и безопасности, дедлайнах и старте, расписании, матчах и соперниках, группах и плей-офф, Best Of, командных и кооперативных составах, капитанах и приглашениях, счёте, пенальти, спорах, регламенте, FAQ, таблицах, сетках, рейтинге, достижениях, уведомлениях и навигации.

Правила поведения:
- Говори спокойно, уважительно и по делу. В споре выступай нейтральным судьёй: разделяй подтверждённые факты, правила и предположения, не выбирай победителя без данных и направляй спор к администратору, если доказательств недостаточно.
- Для правил учитывай общий регламент (regulations), FAQ и специальные правила турнира (tournament.rules). При конфликте приоритет у специальных правил конкретного турнира и его актуальных данных.
- Для ответов про матчи и расписание используй tournament.matches и personalMatch. Если matchCounts.total больше числа переданных матчей, предупреди, что список сокращён.
- Контакты организатора, администратора или судьи бери только из staffContacts. Не выдумывай Telegram-контакты и @username.
- Используй только «Актуальный контекст». Не выдумывай даты, дедлайны, счёт, соперников, правила, статусы или персональные данные.
- Если факта нет в контексте, верни type=unknown, пустой sourceIds и confidence=0; попроси уточнить турнир или обратиться к администрации.
- Не раскрывай тестовые турниры, админские действия, внутренние идентификаторы, токены, приватные данные игроков и способы обхода ограничений.
- Не утверждай, что выполнил действие: бот только консультирует, а изменения делаются на сайте.
- Верни только JSON: answer, type (site | match | schedule | rules | staff | unknown), sourceIds и confidence от 0 до 1. Указывай только источники, в которых действительно есть факт ответа.
- Отвечай на языке пользователя, по умолчанию на русском. Пиши кратко, практично, без HTML-разметки.

Актуальный контекст:
{{context}}`;

const WILLOW_DEFAULT_BASE_URL = "https://api.willowapi.digital/v1";
const WILLOW_DEFAULT_MODEL = "gpt-5.6-luna";
const TELEGRAM_TEXT_LIMIT = 4096;

export type TelegramAiMessage = {
  message_id?: number;
  message_thread_id?: number;
  is_automatic_forward?: boolean;
  from?: { id?: number | string; first_name?: string; username?: string; is_bot?: boolean };
  sender_chat?: { id?: number | string; title?: string };
  reply_to_message?: { from?: { id?: number | string; is_bot?: boolean } };
  chat?: { id?: number | string; type?: "private" | "group" | "supergroup" | "channel"; title?: string };
  text?: string;
  caption?: string;
};

export type TelegramAiContext = {
  user: { name: string | null; telegramUsername: string | null } | null;
  staffContacts: Array<{ name: string; role: string; telegramUsername: string }>;
  regulations: { body: string; version: string } | null;
  faq?: Array<{ title: string; category: string; answer: string }>;
  tournament: {
    id: string;
    title: string;
    rules: string;
    status: string;
    startsAt: string | null;
    registrationStartsAt: string | null;
    registrationEndsAt: string | null;
    description: string;
    format: string;
    participantMode: string;
    rosterSize: number;
    matchupFormat: string;
    bestOfWins: number;
    playoffType: string | null;
    playoffLegs: number;
    pointsForWin: number;
    pointsForDraw: number;
    pointsForLoss: number;
    stages: Array<{
      name: string;
      type: string;
      status: string;
      startsAt: string | null;
      endsAt: string | null;
    }>;
    matches: Array<{
      id: string;
      stage: string | null;
      group: string | null;
      round: number;
      matchNumber: number;
      home: string;
      away: string;
      homeTelegramUsername: string | null;
      awayTelegramUsername: string | null;
      status: string;
      scheduledAt: string | null;
      scheduleStartsAt: string | null;
      scheduleEndsAt: string | null;
      deadlineAt: string | null;
      score: string | null;
    }>;
    matchCounts: { total: number; upcoming: number; completed: number };
  } | null;
  upcomingTournaments: Array<{
    id: string;
    title: string;
    status: string;
    startsAt: string;
    registrationEndsAt: string;
  }>;
  publicTournaments?: Array<{
    id: string;
    title: string;
    status: string;
    startsAt: string;
    endsAt: string | null;
    registrationEndsAt: string;
    prizePool: string | null;
  }>;
  personalMatch: {
    id: string;
    tournamentId: string;
    tournamentTitle: string;
    stage: string;
    round: number;
    opponent: string;
    opponentTelegramUsername: string | null;
    status: string;
    scheduledAt: string | null;
    deadlineAt: string | null;
  } | null;
};

type WillowResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

const telegramAiAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(8_000),
  type: z.enum(["site", "match", "schedule", "rules", "staff", "unknown"]),
  sourceIds: z.array(z.string().trim().min(1)).max(8),
  confidence: z.number().min(0).max(1),
}).strict();

export type TelegramAiAnswer = z.infer<typeof telegramAiAnswerSchema>;

function configuredToken() {
  return process.env.WILLOW_API_TOKEN?.trim() || null;
}

function configuredBaseUrl() {
  return (process.env.WILLOW_API_BASE_URL?.trim() || WILLOW_DEFAULT_BASE_URL).replace(/\/$/, "");
}

function configuredModel() {
  return process.env.WILLOW_API_MODEL?.trim() || WILLOW_DEFAULT_MODEL;
}

function messageText(message: TelegramAiMessage) {
  return message.text?.trim() || message.caption?.trim() || "";
}

export function extractTelegramRound(text: string) {
  const patterns = [
    /(?:^|[^\p{L}\p{N}])(\d{1,3})\s*(?:[-‑–]\s*)?(?:й|ый|ой)?\s*тур(?:а|е|ом)?(?=$|[^\p{L}\p{N}])/iu,
    /(?:^|[^\p{L}\p{N}])тур(?:а|е|ом)?\s*№?\s*(\d{1,3})(?=$|[^\p{L}\p{N}])/iu,
    /(?:^|[^\p{L}\p{N}])(?:round|раунд)\s*№?\s*(\d{1,3})(?=$|[^\p{L}\p{N}])/iu,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const round = match?.[1] ? Number(match[1]) : NaN;
    if (Number.isInteger(round) && round > 0) return round;
  }
  return null;
}

export function isTelegramPersonalMatchQuestion(text: string) {
  return /с\s+кем|кто\s+(?:(?:мой|у\s+меня)\b|(?:мой\s+)?соперник)|мой(?:\s+ближайший)?\s+матч|у\s+меня\s+матч|мой\s+соперник\s*[?!.]*$|соперник\s+(?:в|на)\s+\d{1,3}(?:-?(?:м|й))?\s+тур|против\s+кого|когда\s+я\s+играю/iu.test(text);
}

const tournamentTopicPattern = /efootball|nexon|сайт|платформ|аккаунт|вход|авторизац|регист|профил|безопасн|настройк|турнир|кубок|матч|соперник|регламент|правил|дедлайн|расписан|таблиц|сетк|рейтинг|достиж|команд|капитан|состав|игрок|игра(?:ет|ть)?|сч[её]т|результат|пенальт|спор|заявк|плей[- ]?офф|best\s*of|админ|организатор|судья|модератор|уведомлен|навигац|faq|часто\s+задаваем|приз|победител|побед|место|занял|архив|завершен|завершён/i;
const matchIncidentPattern = /(?:соп\p{L}{0,5}ник|игрок).{0,100}(?:выш\p{L}*|покин\p{L}*|разорвал\p{L}*|отключ\p{L}*|дисконнект\p{L}*)|(?:выш\p{L}*|покин\p{L}*|разорвал\p{L}*|отключ\p{L}*|дисконнект\p{L}*).{0,100}(?:соп\p{L}{0,5}ник|игрок|матч)|разрыв\s+связи/iu;
const tournamentChatContextPattern = /когда\s+(?:начинаем|играем)|кто\s+(?:сегодня\s+)?играет|где\s+(?:играть|проводится)|во\s+сколько|что\s+по\s+(?:игре|туру|раунду)|когда\s+следующ(?:ая|ий)\s+(?:игра|тур)/i;
const unrelatedSmallTalkPattern = /^(?:как дела|как ты|всем привет|привет|доброе утро|добрый вечер)[!?؟¿.,\s]*$/i;

const moderationPattern = /(?:^|[^а-яё])(?:хуй|ху[её]в|пизд|еб(?:а|о|у|л|н)|бля|су[кч]|долбо|мраз|тварь|дебил|идиот|козел|коз[её]л|заткнись)(?:[^а-яё]|$)/i;

export function isTelegramAbusiveMessage(message: TelegramAiMessage) {
  const text = messageText(message).toLowerCase().replace(/ё/g, "е");
  return Boolean(text && moderationPattern.test(text));
}

export function isTelegramAiRelevantMessage(
  message: TelegramAiMessage,
  botUsername?: string | null,
  options?: { tournamentChat?: boolean },
) {
  const text = messageText(message);
  if (!text) return false;
  if (message.from?.is_bot || message.is_automatic_forward) return false;
  const askMatch = text.match(/^\/ask(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i);
  if (askMatch) {
    const question = askMatch[1]?.trim();
    return !question || tournamentTopicPattern.test(question) || matchIncidentPattern.test(question) || Boolean(options?.tournamentChat && tournamentChatContextPattern.test(question));
  }
  if (text.startsWith("/")) return false;
  if (message.chat?.type === "private") return (tournamentTopicPattern.test(text) || matchIncidentPattern.test(text)) && !unrelatedSmallTalkPattern.test(text);

  const username = botUsername?.trim().replace(/^@/, "");
  const mentionsBot = username ? new RegExp(`@${username}\\b`, "i").test(text) : false;
  const repliesToBot = message.reply_to_message?.from?.is_bot === true;
  if (mentionsBot || repliesToBot) {
    const textWithoutMention = username ? text.replace(new RegExp(`@${username}\\b`, "ig"), "").trim() : text;
    return Boolean(textWithoutMention)
      && !unrelatedSmallTalkPattern.test(textWithoutMention)
      && (tournamentTopicPattern.test(textWithoutMention) || matchIncidentPattern.test(textWithoutMention) || Boolean(options?.tournamentChat && tournamentChatContextPattern.test(textWithoutMention)));
  }

  if (tournamentTopicPattern.test(text) || matchIncidentPattern.test(text)) return true;
  if (!options?.tournamentChat || unrelatedSmallTalkPattern.test(text)) return false;
  return tournamentChatContextPattern.test(text);
}

function serializeContext(context: TelegramAiContext) {
  return JSON.stringify(context, null, 2);
}

function availableSourceIds(context: TelegramAiContext) {
  const ids = new Set<string>();
  if (context.user) ids.add("user");
  if (context.staffContacts.length) ids.add("staffContacts");
  if (context.regulations?.body.trim()) ids.add("regulations");
  if (context.faq?.length) ids.add("faq");
  if (context.tournament) {
    ids.add("tournament");
    if (context.tournament.rules.trim()) ids.add("tournament.rules");
    if (context.tournament.stages.length) ids.add("tournament.stages");
    if (context.tournament.matches.length) ids.add("tournament.matches");
  }
  if (context.upcomingTournaments.length) ids.add("upcomingTournaments");
  if (context.publicTournaments?.length) ids.add("publicTournaments");
  if (context.personalMatch) ids.add("personalMatch");
  return ids;
}

const sourcesByAnswerType: Record<Exclude<TelegramAiAnswer["type"], "unknown">, ReadonlySet<string>> = {
  site: new Set(["faq", "regulations", "tournament", "upcomingTournaments", "publicTournaments"]),
  match: new Set(["personalMatch", "tournament.matches"]),
  schedule: new Set(["personalMatch", "tournament", "tournament.stages", "tournament.matches", "upcomingTournaments", "publicTournaments"]),
  rules: new Set(["regulations", "tournament.rules", "faq"]),
  staff: new Set(["staffContacts"]),
};

function rejectWillowAnswer(reason: string, details?: Record<string, unknown>): null {
  if (process.env.NODE_ENV !== "test") {
    console.warn("[telegram-ai] grounded answer rejected", { reason, ...details });
  }
  return null;
}

function resolveRegulationsMatchIncident(text: string, context: TelegramAiContext): TelegramAiAnswer | null {
  if (!matchIncidentPattern.test(text)) return null;

  const regulations = context.regulations?.body.trim();
  if (!regulations) return null;

  // Tournament-specific incident rules need the model to resolve their priority over the general regulations.
  if (context.tournament?.rules && /разрыв\s+связи|умышленн\p{L}*\s+(?:выход|разрыв)|дисконнект/iu.test(context.tournament.rules)) {
    return null;
  }

  const hasContinuationRule = /разрыв\p{L}*\s+связи[\s\S]{0,180}матч\s+доигрыва/iu.test(regulations);
  const hasIntentionalExitRule = /умышленн\p{L}*[\s\S]{0,180}(?:разорвал\p{L}*\s+связь|выш\p{L}*)[\s\S]{0,180}техническ\p{L}*\s+поражен/iu.test(regulations);
  if (!hasContinuationRule && !hasIntentionalExitRule) return null;

  const scoreMatch = text.match(/(?:сч[её]т\p{L}*\s*)?(\d{1,2})\s*[:\-]\s*(\d{1,2})/iu);
  const score = scoreMatch ? `${scoreMatch[1]}:${scoreMatch[2]}` : null;
  const minuteMatch = text.match(/(\d{1,3})(?:-?(?:й|я|ю|ой))?\s*минут/iu);
  const minute = minuteMatch?.[1] ?? null;
  const details = [score ? `счёт ${score}` : null, minute ? `выход на ${minute}-й минуте` : null].filter(Boolean).join(" и ");

  const parts = [
    `Зафиксируйте${details ? ` ${details}` : " произошедшее"}${/рекомендуем\s+всем\s+игрокам\s+записывать\s+экран/iu.test(regulations) ? " на видео" : ""} и сохраните переписку с соперником.`,
  ];
  if (hasContinuationRule) {
    parts.push(`По общему регламенту при разрыве связи матч нужно доиграть${score ? ` с сохранением счёта ${score}` : " с сохранением счёта"}.`);
  }
  if (hasIntentionalExitRule) {
    parts.push("Если соперник вышел умышленно и отказывается продолжать, ему засчитывается техническое поражение.");
  }
  const appealWindow = /претензи\p{L}*[\s\S]{0,220}24\s+час/iu.test(regulations) ? " в течение 24 часов" : "";
  parts.push(`Напишите сопернику о доигровке; при отказе передайте видео и переписку администрации${appealWindow}.`);

  return {
    answer: parts.join(" "),
    type: "rules",
    sourceIds: ["regulations"],
    confidence: 1,
  };
}

function extractContent(payload: WillowResponse) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type?: string; text?: string } => typeof part === "object" && part !== null)
      .map((part) => part.text)
      .filter((part): part is string => Boolean(part))
      .join("")
      .trim();
  }
  return "";
}

export async function askWillow(params: {
  text: string;
  context: TelegramAiContext;
  fetchImpl?: typeof fetch;
}) {
  const token = configuredToken();
  if (!token) return rejectWillowAnswer("missing_token");

  const fetchImpl = params.fetchImpl ?? fetch;
  const response = await fetchImpl(`${configuredBaseUrl()}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(12_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: configuredModel(),
      temperature: 0.2,
      max_tokens: 600,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "telegram_tournament_answer",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["answer", "type", "sourceIds", "confidence"],
            properties: {
              answer: { type: "string" },
              type: { type: "string", enum: ["site", "match", "schedule", "rules", "staff", "unknown"] },
              sourceIds: { type: "array", items: { type: "string" }, maxItems: 8 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
          },
        },
      },
      messages: [
        { role: "system", content: TELEGRAM_AI_SYSTEM_PROMPT.replace("{{context}}", serializeContext(params.context)) },
        { role: "user", content: params.text },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as WillowResponse | null;
  if (!response.ok) throw new Error(`Willow API returned HTTP ${response.status}`);
  const content = payload ? extractContent(payload) : "";
  if (!content) return rejectWillowAnswer("empty_response");
  const parsedJson = (() => {
    try { return JSON.parse(content) as unknown; } catch { return null; }
  })();
  if (parsedJson === null) return rejectWillowAnswer("invalid_json");
  const parsed = telegramAiAnswerSchema.safeParse(parsedJson);
  if (!parsed.success) return rejectWillowAnswer("schema_validation_failed");
  if (parsed.data.type === "unknown") return rejectWillowAnswer("unknown_answer");
  if (parsed.data.confidence < 0.7) return rejectWillowAnswer("low_confidence", { confidence: parsed.data.confidence });
  if (parsed.data.sourceIds.length === 0) return rejectWillowAnswer("missing_sources");
  const groundedAnswer = parsed.data as TelegramAiAnswer & { type: Exclude<TelegramAiAnswer["type"], "unknown"> };
  const validSources = availableSourceIds(params.context);
  if (groundedAnswer.sourceIds.some((sourceId) => !validSources.has(sourceId))) {
    return rejectWillowAnswer("unavailable_source", { sourceIds: groundedAnswer.sourceIds });
  }
  if (!groundedAnswer.sourceIds.some((sourceId) => sourcesByAnswerType[groundedAnswer.type].has(sourceId))) {
    return rejectWillowAnswer("source_type_mismatch", { type: groundedAnswer.type, sourceIds: groundedAnswer.sourceIds });
  }
  return groundedAnswer;
}

function splitTelegramText(text: string) {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > TELEGRAM_TEXT_LIMIT) {
    const boundary = remaining.lastIndexOf("\n", TELEGRAM_TEXT_LIMIT);
    const cut = boundary > TELEGRAM_TEXT_LIMIT / 2 ? boundary : TELEGRAM_TEXT_LIMIT;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function handleTelegramAiMessage(params: {
  message: TelegramAiMessage;
  context: TelegramAiContext;
  botUsername?: string | null;
  tournamentChat?: boolean;
  ask?: typeof askWillow;
  resolveQuestion?: (params: { text: string; context: TelegramAiContext }) => Promise<TelegramAiAnswer | null>;
  send?: (params: Parameters<typeof sendTelegramMessage>[0]) => Promise<TelegramSentMessage>;
}) {
  const chatId = params.message.chat?.id == null ? null : String(params.message.chat.id);
  const messageId = params.message.message_id;
  const text = messageText(params.message);
  const chatType = params.message.chat?.type;
  if (!chatId || !messageId || !text || !chatType || !["private", "group", "supergroup", "channel"].includes(chatType)) {
    return { handled: false } as const;
  }
  if (!isTelegramAiRelevantMessage(params.message, params.botUsername, { tournamentChat: params.tournamentChat })) {
    return { handled: false } as const;
  }

  const commandMatch = text.match(/^\/ask(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i);
  const firstName = params.message.from?.first_name?.trim().replace(/[\r\n\t]+/g, " ").slice(0, 64);
  const address = firstName ? `${firstName}, ` : "";
  const send = params.send ?? sendTelegramMessage;
  const sendReply = async (replyText: string, replyMarkup?: TelegramInlineKeyboardMarkup) => {
    await send({
      chatId,
      text: `${address}${replyText}`,
      parseMode: null,
      disableWebPagePreview: true,
      ...(replyMarkup ? { replyMarkup } : {}),
      ...(messageId ? { replyParameters: { messageId, allowSendingWithoutReply: true } } : {}),
      ...(params.message.message_thread_id !== undefined ? { messageThreadId: params.message.message_thread_id } : {}),
    });
  };
  const resolveAnswer = async (question: string) => (
    (params.resolveQuestion ? await params.resolveQuestion({ text: question, context: params.context }) : null)
    ?? resolveRegulationsMatchIncident(question, params.context)
    ?? await (params.ask ?? askWillow)({ text: question, context: params.context })
  );

  if (!commandMatch) {
    const answer = await resolveAnswer(text);
    if (!answer) {
      return { handled: true, grounded: false } as const;
    }
    const replyMarkup = buildTelegramAiReplyMarkup(params.context);
    for (const [index, chunk] of splitTelegramText(answer.answer).entries()) {
      await send({
        chatId,
        text: index === 0 ? `${address}${chunk}` : chunk,
        parseMode: null,
        disableWebPagePreview: true,
        ...(index === 0 && replyMarkup ? { replyMarkup } : {}),
        ...(index === 0 && messageId ? { replyParameters: { messageId, allowSendingWithoutReply: true } } : {}),
        ...(params.message.message_thread_id !== undefined ? { messageThreadId: params.message.message_thread_id } : {}),
      });
    }
    return { handled: true, text: answer.answer, answerType: answer.type, sourceIds: answer.sourceIds } as const;
  }

  const question = commandMatch[1]?.trim();
  if (!question) {
    await sendReply(`введите вопрос после команды, например: /ask ваш вопрос`);
    return { handled: true, promptedForQuestion: true } as const;
  }

  const answer = await resolveAnswer(question);
  if (!answer) {
    await sendReply("данные не найдены. Уточните турнир или обратитесь к основателю Kumyk: @Kumyk007.");
    return { handled: true, grounded: false } as const;
  }

  const replyMarkup = buildTelegramAiReplyMarkup(params.context);
  for (const [index, chunk] of splitTelegramText(answer.answer).entries()) {
    await send({
      chatId,
      text: index === 0 ? `${address}${chunk}` : chunk,
      parseMode: null,
      disableWebPagePreview: true,
      ...(index === 0 && replyMarkup ? { replyMarkup } : {}),
      ...(index === 0 && messageId ? { replyParameters: { messageId, allowSendingWithoutReply: true } } : {}),
      ...(params.message.message_thread_id !== undefined ? { messageThreadId: params.message.message_thread_id } : {}),
    });
  }
  return { handled: true, text: answer.answer, answerType: answer.type, sourceIds: answer.sourceIds } as const;
}

export function buildEmptyTelegramAiContext(): TelegramAiContext {
  return { user: null, staffContacts: [], regulations: null, faq: [], tournament: null, upcomingTournaments: [], publicTournaments: [], personalMatch: null };
}

export function buildTelegramAiReplyMarkup(context: TelegramAiContext): TelegramInlineKeyboardMarkup | undefined {
  const siteBaseUrl = getConfiguredSiteBaseUrl();
  const buttons: Array<{ text: string; url: string; row: number }> = [];

  if (context.personalMatch) {
    buttons.push({
      text: "Мой матч",
      url: new URL(`/tournaments/${context.personalMatch.tournamentId}?tab=my-matches`, siteBaseUrl).toString(),
      row: 1,
    });
  }

  if (context.tournament) {
    buttons.push({
      text: "Открыть турнир",
      url: new URL(`/tournaments/${context.tournament.id}`, siteBaseUrl).toString(),
      row: 2,
    });
    buttons.push({
      text: "Регламент",
      url: new URL(`/tournaments/${context.tournament.id}?tab=rules`, siteBaseUrl).toString(),
      row: 2,
    });
    buttons.push({
      text: "Расписание",
      url: new URL(`/tournaments/${context.tournament.id}?tab=matches`, siteBaseUrl).toString(),
      row: 3,
    });
  } else if (context.upcomingTournaments.length > 0) {
    buttons.push({
      text: "Ближайшие турниры",
      url: new URL("/tournaments", siteBaseUrl).toString(),
      row: 1,
    });
  }

  return buildTelegramInlineKeyboard(buttons.map((button) => ({ ...button, callbackData: undefined })));
}
