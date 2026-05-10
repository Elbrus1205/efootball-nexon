import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Clock3, MessageCircle, Send, ShieldCheck, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Контакты | eFootball Nexon",
  description: "Связь с администрацией eFootball Nexon по турнирам, матчам, аккаунтам и спорным результатам.",
};

const adminTelegramHref = "https://t.me/Kumyk007";
const telegramChannelHref = "https://t.me/efootball_nexon";
const vkHref = "https://vk.com/efootball_nexon";

const contactMethods = [
  {
    title: "Администратор",
    value: "@Kumyk007",
    description: "Пишите по спорным матчам, регистрации, аккаунту и срочным вопросам.",
    href: adminTelegramHref,
    icon: MessageCircle,
  },
  {
    title: "Telegram-канал",
    value: "t.me/efootball_nexon",
    description: "Новости турниров, объявления, сезоны и важные обновления.",
    href: telegramChannelHref,
    icon: Send,
  },
  {
    title: "VK-канал",
    value: "vk.com/efootball_nexon",
    description: "Сообщество проекта, публикации и связь с игроками.",
    href: vkHref,
    icon: Users,
  },
];

const helpTopics = [
  {
    title: "Спор по матчу",
    text: "Отправьте ссылку на матч, счёт и скриншоты результата.",
    icon: AlertTriangle,
  },
  {
    title: "Регистрация",
    text: "Поможем с заявкой, клубом, ником или ошибкой входа.",
    icon: ShieldCheck,
  },
  {
    title: "Расписание",
    text: "Пишите, если матч не появился или время указано неверно.",
    icon: Clock3,
  },
];

export default function ContactsPage() {
  return (
    <main className="page-shell space-y-4 py-4 sm:space-y-6 sm:py-6">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(8,14,24,0.97),rgba(8,18,30,0.92))] shadow-[0_22px_64px_rgba(0,0,0,0.28)]">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary sm:text-xs">
              <Trophy className="h-3.5 w-3.5" />
              Контакты
            </div>

            <div className="space-y-2.5">
              <h1 className="font-display text-2xl font-thin leading-tight text-white sm:text-4xl">Связь с eFootball Nexon</h1>
              <p className="text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
                Для помощи по турнирам и матчам пишите администратору в Telegram. Каналы проекта используйте для новостей и объявлений.
              </p>
            </div>

            <Button asChild className="h-10 rounded-lg sm:h-11">
              <Link href={adminTelegramHref} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Написать администратору
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {contactMethods.map((method) => {
          const Icon = method.icon;

          return (
            <Link
              key={method.title}
              href={method.href}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-primary/35 hover:bg-white/[0.06] sm:p-5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white sm:h-11 sm:w-11">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="text-base font-black text-white sm:text-lg">{method.title}</div>
              <div className="mt-1 break-words text-xs font-semibold text-primary sm:text-sm">{method.value}</div>
              <p className="mt-2 text-xs leading-5 text-zinc-400 sm:mt-3 sm:text-sm sm:leading-6">{method.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {helpTopics.map((topic) => {
          const Icon = topic.icon;

          return (
            <div key={topic.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-primary">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white sm:text-base">{topic.title}</div>
                  <p className="mt-1.5 text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">{topic.text}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
