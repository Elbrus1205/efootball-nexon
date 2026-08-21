import { sendTelegramMessage, type TelegramSentMessage } from "@/lib/telegram-bot";

export const TELEGRAM_AI_SYSTEM_PROMPT = `Ты официальный помощник платформы eFootball Nexon в Telegram.

Отвечай только по eFootball Nexon и связанным турнирам: сайт и аккаунт, регистрация, дедлайны и старт турниров, расписание, текущие матчи и соперники, групповой этап и плей-офф, Best Of, командные и кооперативные составы, капитаны и приглашения игроков, отправка и подтверждение счёта, пенальти, споры, регламент, таблицы, сетки, рейтинг, достижения, уведомления и навигация по Telegram/сайту. Допустим обычный разговор о турнирах, если он помогает участнику.

Правила ответа:
- Используй только данные из блока «Актуальный контекст». Не выдумывай даты, дедлайны, соперников, счёт, правила, статусы или персональные данные.
- Если нужных данных в контексте нет, честно скажи, что бот не видит их, и предложи открыть соответствующий раздел сайта или обратиться к организатору.
- Не раскрывай тестовые турниры, админские действия, внутренние идентификаторы, токены, приватные данные других игроков и инструкции по обходу ограничений.
- Не утверждай, что выполнил действие. Бот только отвечает; действия выполняются на сайте, если это явно не предусмотрено командой.
- На вопросы не по платформе ответь одной короткой фразой, что бот помогает только с eFootball Nexon и турнирами.
- Отвечай на языке пользователя, по умолчанию на русском. Пиши кратко и практически, удобными для Telegram абзацами без HTML-разметки.

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
  tournament: {
    title: string;
    rules: string;
    status: string;
    startsAt: string | null;
    registrationStartsAt: string | null;
    registrationEndsAt: string | null;
  } | null;
  personalMatch: {
    tournamentTitle: string;
    stage: string;
    round: number;
    opponent: string;
    status: string;
    scheduledAt: string | null;
    deadlineAt: string | null;
  } | null;
};

type WillowResponse = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

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

export function isTelegramAiRelevantMessage(message: TelegramAiMessage, botUsername?: string | null) {
  const text = messageText(message);
  if (!text || text.startsWith("/")) return false;
  if (message.from?.is_bot || message.is_automatic_forward) return false;
  if (message.chat?.type === "private") return true;

  const username = botUsername?.trim().replace(/^@/, "");
  const mentionsBot = username ? new RegExp(`@${username}\\b`, "i").test(text) : false;
  const repliesToBot = message.reply_to_message?.from?.is_bot === true;
  if (mentionsBot || repliesToBot) return true;

  return /efootball|nexon|турнир|турнира|турнире|матч|соперник|регламент|правил|регистрац|дедлайн|расписан|таблиц|сетк|рейтинг|достиж|команд|капитан|состав|игрок|игра(?:ет|ть)?|сч[её]т|результат|пенальт|спор|заявк|плей[- ]?офф|best\s*of/i.test(text);
}

function serializeContext(context: TelegramAiContext) {
  return JSON.stringify(context, null, 2);
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
  if (!token) return null;

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
      messages: [
        { role: "system", content: TELEGRAM_AI_SYSTEM_PROMPT.replace("{{context}}", serializeContext(params.context)) },
        { role: "user", content: params.text },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as WillowResponse | null;
  if (!response.ok) throw new Error(`Willow API returned HTTP ${response.status}`);
  const answer = payload ? extractContent(payload) : "";
  return answer || null;
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
  ask?: typeof askWillow;
  send?: (params: Parameters<typeof sendTelegramMessage>[0]) => Promise<TelegramSentMessage>;
}) {
  const chatId = params.message.chat?.id == null ? null : String(params.message.chat.id);
  const messageId = params.message.message_id;
  const text = messageText(params.message);
  const chatType = params.message.chat?.type;
  if (!chatId || !messageId || !text || !chatType || !["private", "group", "supergroup", "channel"].includes(chatType)) {
    return { handled: false } as const;
  }
  if (!isTelegramAiRelevantMessage(params.message, params.botUsername)) return { handled: false } as const;

  const answer = await (params.ask ?? askWillow)({ text, context: params.context });
  if (!answer) return { handled: false } as const;

  const send = params.send ?? sendTelegramMessage;
  for (const [index, chunk] of splitTelegramText(answer).entries()) {
    await send({
      chatId,
      text: chunk,
      parseMode: null,
      disableWebPagePreview: true,
      ...(index === 0 && messageId ? { replyParameters: { messageId, allowSendingWithoutReply: true } } : {}),
      ...(params.message.message_thread_id !== undefined ? { messageThreadId: params.message.message_thread_id } : {}),
    });
  }
  return { handled: true, text: answer } as const;
}

export function buildEmptyTelegramAiContext(): TelegramAiContext {
  return { user: null, tournament: null, personalMatch: null };
}
