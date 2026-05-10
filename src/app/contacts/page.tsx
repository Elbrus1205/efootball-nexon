import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Clock3, Mail, MessageCircle, Send, ShieldCheck, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Контакты | eFootball Nexon",
  description: "Связь с администрацией eFootball Nexon по турнирам, матчам, аккаунтам и спорным результатам.",
};

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@efootball-nexon.ru";
const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";
const vkHref = process.env.NEXT_PUBLIC_SUPPORT_VK_URL ?? "https://vk.com/efootball_nexon";

const contactMethods = [
  {
    title: "Telegram",
    value: "@efootball_nexon",
    description: "Быстрые вопросы по матчам, спорным результатам и турнирам.",
    href: telegramHref,
    icon: Send,
    accent: "from-sky-400/20 to-cyan-400/5 text-sky-200",
  },
  {
    title: "Email",
    value: supportEmail,
    description: "Подробные обращения со скриншотами и описанием ситуации.",
    href: `mailto:${supportEmail}`,
    icon: Mail,
    accent: "from-blue-400/20 to-indigo-400/5 text-blue-200",
  },
  {
    title: "VK",
    value: "vk.com/efootball_nexon",
    description: "Новости, объявления и связь с сообществом турниров.",
    href: vkHref,
    icon: Users,
    accent: "from-violet-400/20 to-sky-400/5 text-violet-100",
  },
];

const helpTopics = [
  {
    title: "Спор по матчу",
    text: "Укажите ссылку на матч, счёт обеих сторон и приложите скриншоты результата.",
    icon: AlertTriangle,
  },
  {
    title: "Регистрация",
    text: "Поможем с заявкой, клубом, ником или ошибкой при входе.",
    icon: ShieldCheck,
  },
  {
    title: "Расписание",
    text: "Пишите, если матч не появился, время неверное или нужна проверка тура.",
    icon: Clock3,
  },
];

export default function ContactsPage() {
  return (
    <main className="page-shell space-y-5 py-4 sm:space-y-6 sm:py-6">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(8,14,24,0.97),rgba(7,26,36,0.88))] shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:rounded-[1.75rem]">
        <div className="p-4 sm:p-7 lg:p-8">
          <div className="max-w-3xl space-y-4 sm:space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary sm:text-xs">
              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Контакты
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-2xl font-thin leading-tight text-white sm:text-4xl lg:text-5xl">Связь с eFootball Nexon</h1>
              <p className="max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
                По турнирам, спорным матчам, регистрации и аккаунту пишите администратору. Быстрее всего отвечаем в Telegram.
              </p>
            </div>

            <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
              <Button asChild className="h-10 rounded-lg sm:h-11">
                <Link href={telegramHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Написать в Telegram
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-10 rounded-lg sm:h-11">
                <Link href={`mailto:${supportEmail}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Написать на email
                </Link>
              </Button>
            </div>
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
              target={method.href.startsWith("http") ? "_blank" : undefined}
              rel={method.href.startsWith("http") ? "noreferrer" : undefined}
              className="group rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-primary/35 hover:bg-white/[0.06] sm:p-5"
            >
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${method.accent} transition group-hover:scale-105 sm:h-11 sm:w-11`}>
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
              <div className="flex gap-3 sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-primary">
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-white sm:text-base">{topic.title}</div>
                  <p className="mt-1.5 text-xs leading-5 text-zinc-400 sm:mt-2 sm:text-sm sm:leading-6">{topic.text}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 sm:p-5">
        <div className="text-sm font-semibold text-emerald-200">По срочным вопросам пишите администратору в Telegram.</div>
        <p className="mt-2 text-xs leading-5 text-emerald-50/75 sm:text-sm sm:leading-6">
          По активному спору лучше писать сразу после матча, пока у игроков есть скриншоты и переписка.
        </p>
        <div className="mt-4">
          <Button asChild className="h-10 rounded-lg sm:h-11">
            <Link href={telegramHref} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              Открыть Telegram
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
