import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle, ArrowUpRight, Headphones, MessageCircle, Send, ShieldCheck, Trophy, Wrench } from "lucide-react";

export const metadata: Metadata = {
  title: "Контакты | eFootball Nexon",
  description: "Связь с поддержкой eFootball Nexon по турнирам, матчам, регистрации, аккаунтам и техническим вопросам.",
};

const adminTelegramHref = "https://t.me/Kumyk007";
const telegramChannelHref = "https://t.me/efootball_nexon";
const vkHref = "https://vk.com/efootball_nexon";

const supportItems = [
  { label: "Администратор", value: "@Kumyk007" },
  { label: "Время ответа", value: "Обычно 1-3 часа" },
  { label: "Помощь по турнирам", value: "Регистрация, матчи, счёт, споры" },
];

const technicalItems = [
  "Проблемы со входом или доступом к аккаунту",
  "Матч не появился или расписание указано неверно",
  "Не загружается результат, счёт или скриншот",
];

const socialLinks = [
  { label: "Telegram-канал", href: telegramChannelHref },
  { label: "VK-сообщество", href: vkHref },
];

export default function ContactsPage() {
  return (
    <main className="page-shell py-4 sm:py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-xl border border-white/10 bg-zinc-950/70 px-4 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.18)] sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-300">
                <Trophy className="h-3.5 w-3.5" />
                eFootball Nexon
              </div>
              <h1 className="text-2xl font-semibold tracking-normal text-white sm:text-3xl">Контакты</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                Нужна помощь по турниру, результату матча, аккаунту или работе сайта? Напишите администратору в Telegram и кратко опишите проблему.
              </p>
            </div>
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-400/10 text-sky-200 sm:flex">
              <Headphones className="h-4 w-4" />
            </div>
          </div>

          <Link
            href={adminTelegramHref}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-sky-500 px-3.5 text-sm font-semibold text-white transition hover:bg-sky-400"
          >
            <MessageCircle className="h-4 w-4" />
            Написать в Telegram
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Контакт администратора
            </div>
            <div className="mt-3 divide-y divide-white/10">
              {supportItems.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-xs text-zinc-500">{item.label}</span>
                  <span className="max-w-[62%] text-right text-sm font-medium leading-5 text-zinc-200">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Wrench className="h-4 w-4 text-sky-300" />
              Техническая поддержка
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Если проблема связана с сайтом, укажите устройство, браузер и приложите скриншот, если он есть.</p>
            <ul className="mt-3 space-y-2">
              {technicalItems.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-zinc-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-medium text-zinc-300">Поддержка eFootball Nexon</div>
          <div className="flex flex-wrap gap-2">
            {socialLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-sky-300/30 hover:text-white"
              >
                <Send className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
