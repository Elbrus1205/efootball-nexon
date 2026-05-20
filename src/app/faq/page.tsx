import { Download, ExternalLink, FileText, ImageIcon, LifeBuoy, PlayCircle } from "lucide-react";
import { FaqAttachmentKind, ProfileStatusTone } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { profileStatusClassName } from "@/lib/profile-status-style";

function attachmentIcon(kind: FaqAttachmentKind) {
  if (kind === FaqAttachmentKind.IMAGE) return ImageIcon;
  if (kind === FaqAttachmentKind.VIDEO) return PlayCircle;
  if (kind === FaqAttachmentKind.FILE) return Download;
  return ExternalLink;
}

function answerParagraphs(answer: string) {
  return answer
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const PROFILE_STATUSES_FAQ_ID = "seed-75-profile-statuses";

const profileStatusFaqBadges = [
  { title: "Чемпион сезона", tone: ProfileStatusTone.GOLD },
  { title: "Вице-чемпион сезона", tone: ProfileStatusTone.PURPLE },
  { title: "Бронзовый призёр", tone: ProfileStatusTone.BLUE },
  { title: "Легенда", tone: ProfileStatusTone.PURPLE },
  { title: "Активный", tone: ProfileStatusTone.BLUE },
  { title: "Надёжный", tone: ProfileStatusTone.BLUE },
] as const;

const accountSecurityFaqItems = [
  {
    title: "Как обезопасить свой аккаунт?",
    paragraphs: [
      "Привяжите к профилю несколько способов входа: Telegram, почту, VK и пароль. Если один способ временно недоступен, вы сможете зайти другим и не потеряете доступ к турнирам, матчам и заказам.",
      "Используйте уникальный пароль, который не повторяется на других сайтах. Не отправляйте пароль, коды входа и ссылки подтверждения другим людям, даже если они представляются администрацией.",
      "После настройки способов входа периодически проверяйте раздел безопасности в профиле. Если увидели незнакомый вход, сразу смените пароль и завершите лишние сессии.",
    ],
  },
  {
    title: "Как привязать Telegram?",
    paragraphs: [
      "Откройте профиль и перейдите в настройки безопасности. В блоке Telegram нажмите кнопку привязки и следуйте подсказке сайта.",
      "После перехода в Telegram нажмите Start или подтвердите привязку через кнопку бота. Возвращайтесь на сайт только после того, как Telegram покажет, что бот запущен.",
      "Telegram нужен для быстрого входа, важных уведомлений, кодов безопасности и восстановления доступа. Если бот заблокирован или чат с ним не начат, уведомления в Telegram приходить не будут.",
    ],
  },
  {
    title: "Как привязать почту?",
    paragraphs: [
      "В профиле откройте настройки безопасности, укажите актуальный email и сохраните изменения. Лучше использовать почту, к которой у вас точно есть постоянный доступ.",
      "После сохранения откройте письмо от сайта и перейдите по ссылке подтверждения. Если письма нет, проверьте Спам, Промоакции и правильность введенного адреса.",
      "Подтвержденная почта помогает восстановить аккаунт, получать важные сообщения и доказывает, что адрес действительно принадлежит вам.",
    ],
  },
  {
    title: "Как привязать VK?",
    paragraphs: [
      "Откройте настройки безопасности в профиле и выберите привязку VK. Сайт перенаправит вас на авторизацию VK ID.",
      "Войдите в нужный VK-аккаунт и разрешите привязку. После возврата на сайт проверьте, что VK появился среди способов входа.",
      "Привязывайте только свой личный VK. Не используйте чужой аккаунт, потому что через него можно будет входить в ваш профиль.",
    ],
  },
  {
    title: "Как создать или сменить пароль?",
    paragraphs: [
      "Перейдите в профиль, откройте настройки безопасности и найдите блок пароля. Если пароля еще нет, выберите создание пароля; если пароль уже есть, используйте смену пароля.",
      "Хороший пароль должен быть длинным, уникальным и не состоять только из имени, даты рождения, ника или названия клуба. Лучше использовать сочетание букв, цифр и символов.",
      "После смены пароля сохраните его в надежном менеджере паролей. Если подозреваете, что кто-то узнал пароль, сразу смените его и проверьте активные сессии.",
    ],
  },
] as const;

export default async function FaqPage() {
  const items = await db.faqItem.findMany({
    where: { isPublished: true },
    include: { attachments: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const groupedItems = items.reduce<Record<string, typeof items>>((groups, item) => {
    const category = item.category || "Общее";
    groups[category] = groups[category] ?? [];
    groups[category].push(item);
    return groups;
  }, {});

  return (
    <div className="page-shell space-y-8">
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <LifeBuoy className="h-3.5 w-3.5" />
          FAQ
        </div>
        <h1 className="font-display text-3xl font-thin text-white sm:text-4xl">Помощь игрокам</h1>
        <p className="max-w-2xl text-sm leading-6 text-zinc-400">
          Короткие ответы по регистрации, турнирам, матчам, профилю, связи и заказам Coins.
        </p>
      </section>

      <div className="grid gap-6">
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-semibold text-white">Безопасность аккаунта</h2>
          </div>

          <div className="grid gap-3">
            {accountSecurityFaqItems.map((item) => (
              <details key={item.title} className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-glow open:bg-white/[0.06]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                  <span>{item.title}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-lg leading-none text-primary transition group-open:rotate-45">
                    +
                  </span>
                </summary>

                <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                  {item.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <section key={category} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <h2 className="text-xl font-semibold text-white">{category}</h2>
            </div>

            <div className="grid gap-3">
              {categoryItems.map((item) => (
                <details key={item.id} className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-glow open:bg-white/[0.06]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                    <span>{item.title}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-lg leading-none text-primary transition group-open:rotate-45">
                      +
                    </span>
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                    {answerParagraphs(item.answer).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  {item.id === PROFILE_STATUSES_FAQ_ID ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {profileStatusFaqBadges.map((status) => (
                        <span key={status.title} className={profileStatusClassName(status.tone, "min-h-7 px-2.5 py-1 text-xs sm:min-h-10 sm:px-4 sm:py-1.5 sm:text-[19px]")}>
                          {status.title}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {item.attachments.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {item.attachments.map((attachment) => {
                        const Icon = attachmentIcon(attachment.kind);

                        if (attachment.kind === FaqAttachmentKind.IMAGE) {
                          return (
                            <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="group/image overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={attachment.url} alt={attachment.title} className="aspect-video w-full object-cover transition group-hover/image:scale-[1.02]" />
                              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white">
                                <Icon className="h-4 w-4 text-primary" />
                                {attachment.title}
                              </div>
                            </a>
                          );
                        }

                        return (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white transition hover:border-primary/30 hover:bg-primary/10"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{attachment.title}</span>
                            <ExternalLink className="h-4 w-4 shrink-0 text-zinc-500" />
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </details>
              ))}
            </div>
          </section>
        ))}

        {!items.length ? <Card className="p-6 text-sm text-zinc-500">FAQ пока пустой. Ответы появятся после публикации в админ-панели.</Card> : null}
      </div>
    </div>
  );
}
