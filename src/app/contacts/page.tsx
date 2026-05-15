import Link from "next/link";
import type { Metadata } from "next";
import { AlertCircle, ArrowUpRight, Clock3, Headphones, MessageCircle, Send, ShieldCheck, Trophy, Wrench } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us | eFootball Nexon",
  description: "Contact eFootball Nexon support for tournament questions, match issues, registration help, and technical problems.",
};

const adminTelegramHref = "https://t.me/Kumyk007";
const telegramChannelHref = "https://t.me/efootball_nexon";
const vkHref = "https://vk.com/efootball_nexon";

const supportItems = [
  { label: "Admin", value: "@Kumyk007" },
  { label: "Response time", value: "Usually within 1-3 hours" },
  { label: "Tournament support", value: "Registration, matches, scores, disputes" },
];

const technicalItems = [
  "Login or account access problems",
  "Missing matches or wrong schedule",
  "Result upload and screenshot issues",
];

const faqItems = [
  {
    question: "What should I include when contacting support?",
    answer: "Send your player nickname, tournament name, match link if available, and a short description of the issue.",
  },
  {
    question: "Where do I report a match dispute?",
    answer: "Message the admin in Telegram with the score, screenshots, and what happened. Keep the message compact and factual.",
  },
  {
    question: "Can support change my Telegram account?",
    answer: "Yes, but only through admin review. This protects tournament accounts from accidental or unwanted changes.",
  },
  {
    question: "How fast are technical issues fixed?",
    answer: "Small account or match issues are usually handled the same day. Larger platform issues may take longer.",
  },
];

const socialLinks = [
  { label: "Telegram Channel", href: telegramChannelHref },
  { label: "VK Community", href: vkHref },
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
              <h1 className="text-2xl font-semibold tracking-normal text-white sm:text-3xl">Contact Us</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                Need help with a tournament, match result, account, or platform issue? Send a clear message and the support team will help you sort it out.
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
            Telegram Support
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              Admin Contact
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
              Technical Support
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">For site problems, include your device, browser, and a screenshot if possible.</p>
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

        <section className="rounded-xl border border-white/10 bg-zinc-950/55 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white">FAQ</h2>
              <p className="mt-1 text-xs text-zinc-500">Quick answers before you message support.</p>
            </div>
            <Clock3 className="h-4 w-4 text-zinc-500" />
          </div>

          <div className="space-y-2">
            {faqItems.map((item, index) => (
              <details key={item.question} className="group rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5" open={index === 0}>
                <summary className="cursor-pointer list-none text-sm font-medium text-zinc-100 outline-none transition group-open:text-white">
                  <span className="inline-flex w-full items-center justify-between gap-3">
                    {item.question}
                    <span className="text-lg leading-none text-zinc-500 transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-medium text-zinc-300">eFootball Nexon Support</div>
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
