import { LifeBuoy } from "lucide-react";
import { ProfileStatusTone } from "@prisma/client";
import { FaqSearch, type FaqSearchEntry } from "@/components/faq/faq-search";
import { db } from "@/lib/db";
import { buildFaqSearchText, resolveFaqBlocks, type FaqBlock } from "@/lib/faq/content";
import { profileStatusClassName } from "@/lib/profile-status-style";
import {
  RELIABILITY_MAX_SCORE,
  RELIABILITY_RECOVERY_SCORE_CAP,
  RELIABILITY_REGISTRATION_THRESHOLD,
  RELIABILITY_RESTRICTION_DAYS,
} from "@/lib/services/reliability";

export const revalidate = 300;

const PROFILE_STATUSES_FAQ_ID = "seed-75-profile-statuses";

const profileStatusFaqBadges = [
  { title: "Действующий чемпион", tone: ProfileStatusTone.GOLD },
  { title: "Чемпион сезона", tone: ProfileStatusTone.GOLD },
  { title: "Вице-чемпион сезона", tone: ProfileStatusTone.PURPLE },
  { title: "Бронзовый призёр", tone: ProfileStatusTone.BLUE },
  { title: "Легенда", tone: ProfileStatusTone.PURPLE },
  { title: "Активный", tone: ProfileStatusTone.BLUE },
  { title: "Надёжный", tone: ProfileStatusTone.BLUE },
] as const;

function paragraphsToBlocks(paragraphs: readonly string[]): FaqBlock[] {
  return paragraphs.map((text) => ({ type: "text", text }));
}

const staticSections: { category: string; items: { id: string; title: string; paragraphs: readonly string[] }[] }[] = [
  {
    category: "Безопасность аккаунта",
    items: [
      {
        id: "static-secure-account",
        title: "Как обезопасить свой аккаунт?",
        paragraphs: [
          "Привяжите к профилю несколько способов входа: Telegram, почту, VK и пароль. Если один способ временно недоступен, вы сможете зайти другим и не потеряете доступ к турнирам, матчам и заказам.",
          "Используйте уникальный пароль, который не повторяется на других сайтах. Не отправляйте пароль, коды входа и ссылки подтверждения другим людям, даже если они представляются администрацией.",
          "После настройки способов входа периодически проверяйте раздел безопасности в профиле. Если увидели незнакомый вход, сразу смените пароль и завершите лишние сессии.",
        ],
      },
      {
        id: "static-link-telegram",
        title: "Как привязать Telegram?",
        paragraphs: [
          "Откройте профиль и перейдите в настройки безопасности. В блоке Telegram нажмите кнопку привязки и следуйте подсказке сайта.",
          "После перехода в Telegram нажмите Start или подтвердите привязку через кнопку бота. Возвращайтесь на сайт только после того, как Telegram покажет, что бот запущен.",
          "Telegram нужен для быстрого входа, важных уведомлений, кодов безопасности и восстановления доступа. Если бот заблокирован или чат с ним не начат, уведомления в Telegram приходить не будут.",
        ],
      },
      {
        id: "static-link-email",
        title: "Как привязать почту?",
        paragraphs: [
          "В профиле откройте настройки безопасности, укажите актуальный email и сохраните изменения. Лучше использовать почту, к которой у вас точно есть постоянный доступ.",
          "После сохранения откройте письмо от сайта и перейдите по ссылке подтверждения. Если письма нет, проверьте Спам, Промоакции и правильность введенного адреса.",
          "Подтвержденная почта помогает восстановить аккаунт, получать важные сообщения и доказывает, что адрес действительно принадлежит вам.",
        ],
      },
      {
        id: "static-link-vk",
        title: "Как привязать VK?",
        paragraphs: [
          "Откройте настройки безопасности в профиле и выберите привязку VK. Сайт перенаправит вас на авторизацию VK ID.",
          "Войдите в нужный VK-аккаунт и разрешите привязку. После возврата на сайт проверьте, что VK появился среди способов входа.",
          "Привязывайте только свой личный VK. Не используйте чужой аккаунт, потому что через него можно будет входить в ваш профиль.",
        ],
      },
      {
        id: "static-password",
        title: "Как создать или сменить пароль?",
        paragraphs: [
          "Перейдите в профиль, откройте настройки безопасности и найдите блок пароля. Если пароля еще нет, выберите создание пароля; если пароль уже есть, используйте смену пароля.",
          "Хороший пароль должен быть длинным, уникальным и не состоять только из имени, даты рождения, ника или названия клуба. Лучше использовать сочетание букв, цифр и символов.",
          "После смены пароля сохраните его в надежном менеджере паролей. Если подозреваете, что кто-то узнал пароль, сразу смените его и проверьте активные сессии.",
        ],
      },
    ],
  },
  {
    category: "Надёжность",
    items: [
      {
        id: "static-reliability-what",
        title: "Что такое надежность?",
        paragraphs: [
          `Надежность - это показатель дисциплины игрока от 0 до ${RELIABILITY_MAX_SCORE}. Он показывает, насколько стабильно игрок подтверждает результаты, доигрывает матчи без технических поражений и не создает спорные ситуации.`,
          "Система нужна не для наказаний ради наказаний, а для защиты турниров: участники быстрее понимают, кому можно доверять расписание матча, а администрация видит повторяющиеся нарушения.",
          "Показатель виден в профиле сразу под рейтингом. Там же отображаются текущий статус, серии подтверждений, чистые матчи подряд и последние изменения надежности.",
        ],
      },
      {
        id: "static-reliability-statuses",
        title: "Какие бывают статусы надежности?",
        paragraphs: [
          `90-${RELIABILITY_MAX_SCORE} - отличная надежность. Игрок стабильно закрывает матчи без нарушений.`,
          "80-89 - хорошая надежность. Игрок допущен к турнирам, но системе уже есть что отслеживать.",
          `${RELIABILITY_REGISTRATION_THRESHOLD}-79 - допущен. Игрок может регистрироваться, но ему важно избегать технических поражений и спорных результатов.`,
          `Ниже ${RELIABILITY_REGISTRATION_THRESHOLD} - ограничен. Регистрация в новые турниры временно закрывается, пока ограничение не закончится или показатель не будет восстановлен правилами системы.`,
        ],
      },
      {
        id: "static-reliability-raise",
        title: "Как повысить надежность?",
        paragraphs: [
          "Подтверждайте результаты вовремя и без задержек. За каждые 10 подтверждений подряд система добавляет +3 к надежности.",
          "Играйте матчи без технических поражений и нарушений. За каждые 10 чистых матчей подряд система добавляет +4 к надежности.",
          `Надежность не растет выше ${RELIABILITY_MAX_SCORE}. Если у игрока уже максимум, бонусы фиксируются в истории, но итоговое значение остается ${RELIABILITY_MAX_SCORE}/100.`,
        ],
      },
      {
        id: "static-reliability-drop",
        title: "За что надежность снижается?",
        paragraphs: [
          "Техническое поражение снижает надежность на 8 пунктов. Это применяется, когда матч завершен форфейтом и система определила проигравшую сторону.",
          "Если за последние 30 дней уже было техническое поражение, повторное нарушение жестче влияет на профиль: при надежности 80 и выше показатель опускается до 80, а при надежности ниже 80 снимается еще 10 пунктов.",
          "Негативные события сбрасывают серии подтверждений и чистых матчей. Поэтому после нарушения бонусные серии нужно набирать заново.",
        ],
      },
      {
        id: "static-reliability-restriction",
        title: "Что происходит при ограничении?",
        paragraphs: [
          `Если надежность падает ниже ${RELIABILITY_REGISTRATION_THRESHOLD}, регистрация в новые турниры закрывается на ${RELIABILITY_RESTRICTION_DAYS} дней. Уже сохраненная история матчей и статистика не удаляются.`,
          `После окончания срока система восстанавливает игрока для повторного допуска: надежность повышается на 10 пунктов, но не выше ${RELIABILITY_RECOVERY_SCORE_CAP}. Если этого достаточно для порога допуска, ограничение снимается.`,
          "Ограничение не скрывает профиль и не удаляет достижения. Оно только защищает новые турниры от повторных срывов регистрации и матчей.",
        ],
      },
    ],
  },
];

function ProfileStatusBadges() {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {profileStatusFaqBadges.map((status) => (
        <span
          key={status.title}
          className={profileStatusClassName(status.tone, "min-h-7 px-2.5 py-1 text-xs sm:min-h-10 sm:px-4 sm:py-1.5 sm:text-[19px]")}
        >
          {status.title}
        </span>
      ))}
    </div>
  );
}

export default async function FaqPage() {
  const items = await db.faqItem.findMany({
    where: { isPublished: true },
    include: { attachments: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const entries: FaqSearchEntry[] = [];

  for (const section of staticSections) {
    for (const item of section.items) {
      const blocks = paragraphsToBlocks(item.paragraphs);
      entries.push({
        id: item.id,
        title: item.title,
        category: section.category,
        blocks,
        searchText: buildFaqSearchText({ title: item.title, category: section.category, blocks }),
      });
    }
  }

  for (const item of items) {
    const blocks = resolveFaqBlocks(item);
    const category = item.category || "Общее";
    entries.push({
      id: item.id,
      title: item.title,
      category,
      blocks,
      searchText: buildFaqSearchText({ title: item.title, category, blocks }),
      extra: item.id === PROFILE_STATUSES_FAQ_ID ? <ProfileStatusBadges /> : undefined,
    });
  }

  return (
    <div className="page-shell space-y-8">
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <LifeBuoy className="h-3.5 w-3.5" />
          FAQ
        </div>
        <h1 className="font-display text-3xl font-thin text-white sm:text-4xl">Помощь игрокам</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          Ответы по регистрации, турнирам, матчам, профилю, безопасности и надёжности. Ищите по словам — поиск смотрит и в
          вопросах, и в тексте ответов.
        </p>
      </section>

      <FaqSearch entries={entries} />
    </div>
  );
}
