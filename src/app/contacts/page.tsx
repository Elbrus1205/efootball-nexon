import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Clock3, Mail, MessageCircle, ShieldCheck, Trophy, Users } from "lucide-react";
import { ContactForm } from "@/components/contacts/contact-form";
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
    description: "Самый быстрый способ для срочных вопросов по матчам и турнирам.",
    href: telegramHref,
    icon: MessageCircle,
  },
  {
    title: "Email",
    value: supportEmail,
    description: "Подходит для подробных обращений, скриншотов и описания спорной ситуации.",
    href: `mailto:${supportEmail}`,
    icon: Mail,
  },
  {
    title: "VK",
    value: "vk.com/efootball_nexon",
    description: "Новости, объявления и связь с сообществом турниров.",
    href: vkHref,
    icon: Users,
  },
];

const helpTopics = [
  {
    title: "Спор по матчу",
    text: "Укажите ссылку на матч, счёт от обеих сторон и приложите скриншоты результата.",
    icon: AlertTriangle,
  },
  {
    title: "Регистрация",
    text: "Поможем с заявкой на турнир, клубом, ником или ошибкой при входе.",
    icon: ShieldCheck,
  },
  {
    title: "Расписание",
    text: "Пишите, если матч не появился, время указано неверно или нужна проверка тура.",
    icon: Clock3,
  },
];

export default function ContactsPage() {
  return (
    <main className="page-shell space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(8,14,24,0.96),rgba(5,24,18,0.9))] shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <Trophy className="h-4 w-4" />
              Контакты
            </div>

            <div className="space-y-4">
              <h1 className="font-display text-4xl font-thin leading-tight text-white sm:text-5xl">Связь с eFootball Nexon</h1>
              <p className="max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
                Напишите администрации по турнирам, спорным матчам, регистрации или аккаунту. Чем точнее описание, тем быстрее получится разобраться.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={telegramHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Написать в Telegram
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`mailto:${supportEmail}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Написать на email
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative min-h-[250px] overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 p-5">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:34px_34px] opacity-25" />
            <div className="relative grid h-full place-items-center">
              <div className="grid grid-cols-3 gap-3">
                {["arsenal.png", "chelsea.png", "real-madrid.png", "barcelona.png", "inter-milan.png", "psg-big-768x768.png"].map((badge) => (
                  <div key={badge} className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
                    <Image src={`/club-badges/${badge}`} alt="" width={56} height={56} className="h-full w-full object-contain" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {contactMethods.map((method) => {
          const Icon = method.icon;

          return (
            <Link
              key={method.title}
              href={method.href}
              target={method.href.startsWith("http") ? "_blank" : undefined}
              rel={method.href.startsWith("http") ? "noreferrer" : undefined}
              className="group rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5 transition hover:border-primary/35 hover:bg-white/[0.06]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-lg font-black text-white">{method.title}</div>
              <div className="mt-1 break-words text-sm font-semibold text-primary">{method.value}</div>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{method.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          {helpTopics.map((topic) => {
            const Icon = topic.icon;

            return (
              <div key={topic.title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-black text-white">{topic.title}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{topic.text}</p>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
            <div className="text-sm font-semibold text-emerald-200">Обычно отвечаем в течение дня.</div>
            <p className="mt-2 text-sm leading-6 text-emerald-50/75">
              По активному спору лучше писать сразу после матча, пока у игроков есть скриншоты и переписка.
            </p>
          </div>
        </div>

        <ContactForm supportEmail={supportEmail} />
      </section>
    </main>
  );
}
