import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import {
  sendTelegramMessage,
  type SendTelegramMessageParams,
  type TelegramSentMessage,
} from "@/lib/telegram-bot";

export type TelegramAutoReply = {
  intent: string;
  text: string;
  button?: { text: string; path: string };
};

export type TelegramAutoReplyMessage = {
  message_id?: number;
  message_thread_id?: number;
  is_automatic_forward?: boolean;
  from?: { id?: number | string; first_name?: string; is_bot?: boolean };
  sender_chat?: { id?: number | string; title?: string };
  chat?: { id?: number | string; type?: "private" | "group" | "supergroup" | "channel"; title?: string };
  text?: string;
  caption?: string;
};

type TelegramAutoReplySender = (params: SendTelegramMessageParams) => Promise<TelegramSentMessage>;

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CHAT_TYPO_ALIASES: Record<string, string> = {
  кк: "как",
  акк: "аккаунт",
  зарегатся: "зарегистрироваться",
  зарегаться: "зарегистрироваться",
  регатся: "регистрироваться",
  регаться: "регистрироваться",
  турик: "турнир",
  турнр: "турнир",
  турнра: "турнира",
  трнир: "турнир",
  россписание: "расписание",
  росписание: "расписание",
  саперник: "соперник",
  сопреник: "соперник",
  атвечает: "отвечает",
  атправить: "отправить",
  ресультат: "результат",
  резкльтат: "результат",
  праила: "правила",
  правла: "правила",
  дедлаин: "дедлайн",
  дедлаен: "дедлайн",
  табла: "таблица",
  тг: "telegram",
};

function normalizeMessage(value: string) {
  const normalized = value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9@/]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized
    .split(" ")
    .map((token) => CHAT_TYPO_ALIASES[token] ?? token)
    .join(" ");
}

export function buildTelegramAutoReply(params: { text: string; firstName?: string | null }): TelegramAutoReply | null {
  const message = normalizeMessage(params.text);
  const name = escapeTelegramHtml(params.firstName?.trim() || "друг");
  const mentionsTournament = /(?:^|\s)т(?:у)?рн?ир[а-я]*(?:\s|$)/.test(message);

  if (/^\/help(?:@[a-z0-9_]+)?$/.test(message) || /что.*умеет.*бот|помощь.*бот|команды.*бот/.test(message)) {
    return {
      intent: "bot-help",
      text: `<b>${name}</b>, я отвечаю на вопросы о регистрации, заявках, составах, матчах, дедлайнах, результатах, правилах, таблицах, рейтинге, надёжности и доступе к аккаунту. Просто напишите вопрос обычными словами.`,
      button: { text: "Все ответы", path: "/faq" },
    };
  }

  if (/удал|закрыть/.test(message) && /аккаунт|профил/.test(message)) {
    return {
      intent: "account-deletion",
      text: `<b>${name}</b>, управление удалением и приватностью находится в настройках профиля. Перед удалением убедитесь, что завершены активные матчи: восстановить удалённые данные может быть невозможно.`,
      button: { text: "Настройки приватности", path: "/dashboard/privacy" },
    };
  }

  if (/бан|заблок|ограничили аккаунт/.test(message)) {
    return {
      intent: "account-restriction",
      text: `<b>${name}</b>, проверьте уведомление с причиной ограничения. Если считаете блокировку ошибочной, не создавайте новый аккаунт — свяжитесь с администрацией и приложите свой Telegram username и описание ситуации.`,
      button: { text: "Связаться с администрацией", path: "/contacts" },
    };
  }

  if (/уведомлен|оповещен/.test(message) && /не приход|нет|включ|настро/.test(message)) {
    return {
      intent: "notifications",
      text: `<b>${name}</b>, проверьте привязку Telegram в настройках безопасности и убедитесь, что бот не заблокирован. Push-уведомления на телефоне работают в установленном приложении после разрешения браузера.`,
      button: { text: "Настроить уведомления", path: "/dashboard/security" },
    };
  }

  if (/связаться|написать|обратиться/.test(message) && /админ|организатор|поддержк|судь/.test(message)) {
    return {
      intent: "support",
      text: `<b>${name}</b>, опишите проблему спокойно и приложите ссылку на турнир или матч, свой Telegram username и скриншоты. Контакты администрации доступны на отдельной странице.`,
      button: { text: "Открыть контакты", path: "/contacts" },
    };
  }

  if (/рейтинг/.test(message)) {
    return {
      intent: "ratings",
      text: `<b>${name}</b>, общий рейтинг игроков находится в разделе «Рейтинги». Он обновляется после подтверждённых матчей; спорные и неподтверждённые результаты в расчёт не входят.`,
      button: { text: "Открыть рейтинги", path: "/ratings" },
    };
  }

  if (/достижен|ачив/.test(message)) {
    return {
      intent: "achievements",
      text: `<b>${name}</b>, достижения выдаются автоматически за выполненные условия — матчи, серии результатов и активность на платформе. Полученные награды отображаются в вашем профиле.`,
      button: { text: "Мои достижения", path: "/dashboard/achievements" },
    };
  }

  if (/что.*надежн|зачем.*надежн|как.*работает.*надежн/.test(message)) {
    return {
      intent: "reliability",
      text: `<b>${name}</b>, надёжность показывает дисциплину игрока: своевременные подтверждения укрепляют показатель, а технические поражения и нарушения снижают его. Низкий балл может временно ограничить новые регистрации.`,
      button: { text: "Подробнее о надёжности", path: "/faq" },
    };
  }

  if (/монет|коин|coin/.test(message)) {
    return {
      intent: "coins",
      text: `<b>${name}</b>, раздел монет и доступных предложений находится на платформе. Условия покупки и доступность способа оплаты показываются перед оформлением.`,
      button: { text: "Открыть монеты", path: "/coins" },
    };
  }

  if (/измен|помен|редакт/.test(message) && /имя|ник|аватар|профил/.test(message)) {
    return {
      intent: "profile-edit",
      text: `<b>${name}</b>, имя, аватар и другие публичные данные меняются в редакторе профиля. Используйте актуальные данные, по которым соперники смогут вас узнать.`,
      button: { text: "Редактировать профиль", path: "/dashboard/edit" },
    };
  }

  if (/парол/.test(message) && /забыл|восстанов|сброс|не помн/.test(message)) {
    return {
      intent: "password-recovery",
      text: `<b>${name}</b>, откройте восстановление пароля, укажите привязанную почту и подтвердите сброс кодом. Если почта не приходит, проверьте папку «Спам» и правильность адреса.`,
      button: { text: "Восстановить пароль", path: "/forgot-password" },
    };
  }

  if (/телег|telegram/.test(message) && /привяз|подключ|связ/.test(message)) {
    return {
      intent: "telegram-link",
      text: `<b>${name}</b>, войдите в профиль, откройте раздел безопасности и подключите Telegram. После привязки бот сможет присылать приглашения, дедлайны и результаты матчей.`,
      button: { text: "Подключить Telegram", path: "/dashboard/security" },
    };
  }

  if (/аккаунт|профил/.test(message) && /созд|регист/.test(message)) {
    return {
      intent: "account-registration",
      text: `<b>${name}</b>, создайте аккаунт на платформе через Telegram, VK, электронную почту или пароль. После входа заполните профиль и привяжите Telegram, чтобы участвовать в турнирах.`,
      button: { text: "Создать аккаунт", path: "/register" },
    };
  }

  if (/войти|вход|логин/.test(message) && /не могу|не получает|не выходит|почему/.test(message)) {
    return {
      intent: "account-login",
      text: `<b>${name}</b>, попробуйте войти тем способом, который привязан к профилю: Telegram, VK, почта или пароль. Если пароль забыт, используйте восстановление доступа.`,
      button: { text: "Открыть вход", path: "/login" },
    };
  }

  if (/фото|скрин/.test(message) && /состав|линейк/.test(message)) {
    return {
      intent: "lineup-photo",
      text: `<b>${name}</b>, ориентируйтесь на пример в форме регистрации: на фото должен быть виден требуемый состав без обрезанных имён и нечитаемых элементов. Допустимые форматы и обязательность фото задаёт организатор турнира.`,
      button: { text: "Открыть турниры", path: "/tournaments" },
    };
  }

  if (/надежн|репутац/.test(message) && /рег|огранич|недоступ|блок/.test(message)) {
    return {
      intent: "reliability-restriction",
      text: `<b>${name}</b>, при низкой надёжности регистрация в новые турниры временно ограничивается. Причина, текущий балл и срок ограничения показаны в профиле; завершайте матчи и подтверждайте результаты вовремя.`,
      button: { text: "Подробнее о надёжности", path: "/faq" },
    };
  }

  if (/заяв/.test(message) && /отклони|отказ|не приняли/.test(message)) {
    return {
      intent: "application-rejected",
      text: `<b>${name}</b>, причина отклонения отображается рядом с заявкой. Исправьте указанные данные или фото и отправьте заявку повторно, если регистрация ещё открыта; при непонятной причине обратитесь к организатору.`,
      button: { text: "Проверить заявку", path: "/tournaments" },
    };
  }

  if (/заяв/.test(message) && /провер|ожидан|рассмотр|висит/.test(message)) {
    return {
      intent: "application-pending",
      text: `<b>${name}</b>, статус «На проверке» означает, что организатор ещё не принял решение. До одобрения участник не добавляется в состав турнира; результат появится на той же странице и придёт в Telegram.`,
      button: { text: "Проверить заявку", path: "/tournaments" },
    };
  }

  if (/смен|помен|измен/.test(message) && /клуб/.test(message) && /заяв|рег/.test(message)) {
    return {
      intent: "club-change",
      text: `<b>${name}</b>, после отправки заявки не меняйте клуб самостоятельно: допустимость замены зависит от статуса заявки и правил турнира. До старта обратитесь к организатору, чтобы история участия сохранилась корректно.`,
      button: { text: "Открыть турнир", path: "/tournaments" },
    };
  }

  if (/отмен|снять|отказ/.test(message) && /рег|заяв/.test(message) && mentionsTournament) {
    return {
      intent: "registration-cancel",
      text: `<b>${name}</b>, откройте страницу турнира и используйте действие отмены регистрации. Если турнир уже начался или кнопки нет, отмену должен обработать организатор.`,
      button: { text: "Открыть турниры", path: "/tournaments" },
    };
  }

  if (/приглас|приглаш/.test(message) && /игрок|состав|команд/.test(message)) {
    return {
      intent: "roster-invite",
      text: `<b>${name}</b>, капитан отправляет приглашение участнику состава при регистрации команды. Приглашённому нужно открыть турнир через уведомление и принять приглашение; до этого его статус останется ожидающим.`,
      button: { text: "Открыть турниры", path: "/tournaments" },
    };
  }

  if (/команд|состав|2 на 2|2х2|кооп/.test(message) && /рег|участв/.test(message)) {
    return {
      intent: "team-registration",
      text: `<b>${name}</b>, в командном или кооперативном турнире капитан подаёт заявку, выбирает клуб и приглашает остальных игроков. Регистрация завершится после заполнения обязательных данных и принятия приглашений составом.`,
      button: { text: "Выбрать турнир", path: "/tournaments" },
    };
  }

  if (/пенальт/.test(message)) {
    return {
      intent: "match-penalties",
      text: `<b>${name}</b>, если формат матча предусматривает пенальти, сначала укажите основной счёт, затем отдельно счёт серии пенальти. Учитывайте только данные, которые требует форма, и сверяйтесь с правилами турнира.`,
      button: { text: "Открыть турниры", path: "/tournaments" },
    };
  }

  if (/скрин|скриншот|доказ|фото.*результ/.test(message)) {
    return {
      intent: "result-proof",
      text: `<b>${name}</b>, требования к скриншоту или фото состава указаны в правилах и форме конкретного турнира. Сохраняйте подтверждение результата как минимум до окончательного подтверждения матча.`,
      button: { text: "Проверить правила", path: "/tournaments" },
    };
  }

  if (/перенест|перенос|изменить.*врем|договориться.*врем/.test(message) && /матч|игр/.test(message)) {
    return {
      intent: "match-reschedule",
      text: `<b>${name}</b>, согласуйте новое время с соперником до дедлайна и сохраните переписку. Если договориться не получается или срок уже близко, обратитесь к организатору — самостоятельно менять дедлайн нельзя.`,
      button: { text: "Открыть мои матчи", path: "/dashboard/matches" },
    };
  }

  if (/дедлайн|срок.*матч|до какого.*матч/.test(message)) {
    return {
      intent: "match-deadline",
      text: `<b>${name}</b>, дедлайн показан в карточке встречи во вкладке «Мои матчи». Отправьте результат до указанного времени; при проблеме заранее напишите сопернику и организатору.`,
      button: { text: "Проверить дедлайн", path: "/dashboard/matches" },
    };
  }

  if (/соперник/.test(message) && /не отвеч|молчит|пропал|игнор/.test(message)) {
    return {
      intent: "opponent-unresponsive",
      text: `<b>${name}</b>, напишите сопернику ещё раз и сохраните скриншоты попыток связаться. Не указывайте выдуманный счёт: до дедлайна передайте доказательства организатору или судье.`,
      button: { text: "Открыть матч", path: "/dashboard/matches" },
    };
  }

  if (/разн.*счет|счет.*не совп|неверн.*результ|спор.*матч/.test(message)) {
    return {
      intent: "match-dispute",
      text: `<b>${name}</b>, оба участника должны отправить одинаковый счёт. Если данные не совпали, проверьте результат с соперником и отправьте его заново; после повторных расхождений матч перейдёт на проверку администрации.`,
      button: { text: "Открыть матч", path: "/dashboard/matches" },
    };
  }

  if (/отправ|ввест|указ|подтверд/.test(message) && /результ|счет/.test(message)) {
    return {
      intent: "match-result",
      text: `<b>${name}</b>, откройте встречу в разделе «Мои матчи», введите основной счёт и при необходимости пенальти. Матч подтвердится, когда оба участника отправят совпадающие данные.`,
      button: { text: "Открыть мои матчи", path: "/dashboard/matches" },
    };
  }

  if (/где|найти|посмотр/.test(message) && /мой|мои/.test(message) && /матч|игр/.test(message)) {
    return {
      intent: "my-match",
      text: `<b>${name}</b>, ваши назначенные и завершённые встречи находятся в разделе профиля «Матчи» и во вкладке «Мои матчи» на странице турнира.`,
      button: { text: "Открыть мои матчи", path: "/dashboard/matches" },
    };
  }

  if (/правил|регламент/.test(message) && (mentionsTournament || /соревнован/.test(message))) {
    return {
      intent: "tournament-rules",
      text: `<b>${name}</b>, актуальные правила находятся во вкладке «Правила» внутри нужного турнира. Обязательно прочитайте их до регистрации: формат матчей, подтверждение результата и санкции могут отличаться.`,
      button: { text: "Выбрать турнир", path: "/tournaments" },
    };
  }

  if (/расписан|когда.*матч|матч.*когда/.test(message)) {
    return {
      intent: "tournament-schedule",
      text: `<b>${name}</b>, откройте нужный турнир и перейдите во вкладку «Расписание». Личные встречи, сроки и статус отправки счёта собраны во вкладке «Мои матчи».`,
      button: { text: "Открыть турниры", path: "/tournaments" },
    };
  }

  if (/сетк|плей ?офф|плейоф|кто.*проход/.test(message)) {
    return {
      intent: "tournament-bracket",
      text: `<b>${name}</b>, турнирная сетка и переходы между этапами находятся во вкладке «Структура» нужного турнира. Она появится после формирования этапов организатором.`,
      button: { text: "Открыть турниры", path: "/tournaments" },
    };
  }

  if (/турнирн.*таблиц|таблиц.*очк|место.*групп|сколько.*очк/.test(message)) {
    return {
      intent: "tournament-standings",
      text: `<b>${name}</b>, таблица с очками, разницей мячей и местами доступна в структуре турнира. После подтверждения результата она пересчитывается автоматически.`,
      button: { text: "Открыть турниры", path: "/tournaments" },
    };
  }

  if (/приз|наград/.test(message) && (mentionsTournament || /побед/.test(message))) {
    return {
      intent: "tournament-prizes",
      text: `<b>${name}</b>, призовой фонд и награды указаны на странице конкретного турнира. Условия получения определяет организатор в описании и правилах.`,
      button: { text: "Посмотреть турниры", path: "/tournaments" },
    };
  }

  if (/когда|начал|старт/.test(message) && mentionsTournament) {
    return {
      intent: "tournament-start",
      text: `<b>${name}</b>, дата старта указана в карточке турнира. После закрытия регистрации организатор формирует этапы; о назначенных матчах бот пришлёт уведомление.`,
      button: { text: "Проверить турнир", path: "/tournaments" },
    };
  }

  if (/где|найти|какие|список|актуальн/.test(message) && mentionsTournament) {
    return {
      intent: "tournament-list",
      text: `<b>${name}</b>, все доступные турниры находятся в разделе «Турниры». На карточках видно, где регистрация открыта, какой формат используется и когда начинается соревнование.`,
      button: { text: "Открыть турниры", path: "/tournaments" },
    };
  }

  const asksAboutTournamentRegistration = /рег|запис|участв|попасть/.test(message) && mentionsTournament;
  if (!asksAboutTournamentRegistration) return null;

  return {
    intent: "tournament-registration",
    text: `<b>${name}</b>, откройте список турниров, выберите турнир с открытой регистрацией и нажмите «Участвовать в турнире». Затем заполните заявку и подтвердите её. Статус заявки появится на странице турнира.`,
    button: { text: "Открыть турниры", path: "/tournaments" },
  };
}

export async function handleTelegramAutoReply(
  message: TelegramAutoReplyMessage,
  options: { siteBaseUrl?: string; send?: TelegramAutoReplySender } = {},
) {
  const chatId = message.chat?.id != null ? String(message.chat.id) : null;
  const messageId = message.message_id;
  const chatType = message.chat?.type;
  const text = message.text?.trim() || message.caption?.trim();

  if (
    !chatId ||
    !messageId ||
    !text ||
    message.from?.is_bot ||
    message.is_automatic_forward ||
    chatType === "channel" ||
    !["private", "group", "supergroup"].includes(chatType ?? "")
  ) {
    return { handled: false } as const;
  }

  const reply = buildTelegramAutoReply({
    text,
    firstName: message.from?.first_name || message.sender_chat?.title || null,
  });
  if (!reply) return { handled: false } as const;

  const siteBaseUrl = options.siteBaseUrl ?? getConfiguredSiteBaseUrl();
  const replyMarkup = reply.button
    ? { inline_keyboard: [[{ text: reply.button.text, url: new URL(reply.button.path, siteBaseUrl).toString() }]] }
    : undefined;

  await (options.send ?? sendTelegramMessage)({
    chatId,
    text: reply.text,
    disableWebPagePreview: true,
    replyParameters: { messageId, allowSendingWithoutReply: true },
    ...(message.message_thread_id !== undefined ? { messageThreadId: message.message_thread_id } : {}),
    ...(replyMarkup ? { replyMarkup } : {}),
  });

  return { handled: true, intent: reply.intent } as const;
}
