import Link from "next/link";
import { FileText, MessageCircle, ShieldCheck, Trophy, Users } from "lucide-react";

const socialLinks = [
  { href: "https://t.me/", label: "Telegram" },
  { href: "https://vk.com/", label: "VK" },
];

const navigationLinks = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/ratings", label: "Рейтинги" },
  { href: "/regulations", label: "Регламент" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
];

const legalLinks = [
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Пользовательское соглашение" },
  { href: "/cookies", label: "Файлы cookie" },
  { href: "/consent", label: "Согласие на обработку данных" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-gradient-to-b from-transparent to-white/[0.02]">
      <div className="page-shell py-4 sm:py-12">
        <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl sm:gap-6 sm:rounded-[2rem] sm:p-8 lg:grid-cols-[1.2fr_0.8fr_0.9fr]">
          <div className="space-y-3 sm:space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-[0_0_30px_rgba(59,130,246,0.16)] sm:h-12 sm:w-12 sm:rounded-2xl">
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <div className="font-display text-base font-thin text-white sm:text-xl">eFootball Nexon</div>
                <div className="hidden text-sm text-zinc-400 sm:block">eFootball Mobile Tournaments</div>
              </div>
            </div>

            <p className="hidden max-w-md text-sm leading-7 text-zinc-400 sm:block">
              Турнирная платформа для сезонов, сеток, результатов матчей и мобильного участия в событиях eFootball.
            </p>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              {socialLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-primary/30 hover:bg-white/[0.07] hover:text-white sm:rounded-full sm:px-4 sm:py-2 sm:text-sm"
                >
                  {link.label === "Telegram" ? <MessageCircle className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" /> : <Users className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-2 sm:space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Навигация</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 sm:grid sm:gap-3">
              {navigationLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-xs text-zinc-300 transition hover:text-white sm:text-sm">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden space-y-4 sm:block">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Документы</div>
            <div className="grid gap-3">
              {legalLinks.map((link, index) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="inline-flex items-start gap-2 text-sm leading-6 text-zinc-300 transition hover:text-white"
                >
                  {index % 2 === 0 ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500 sm:mt-6 sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:text-sm">
          <p>eFootball Nexon © 2026. Турниры по eFootball Mobile в мобильном формате.</p>
          <p className="hidden sm:block">Next.js 14, Prisma, Auth.js, Pusher, Uploadthing.</p>
        </div>
      </div>
    </footer>
  );
}
