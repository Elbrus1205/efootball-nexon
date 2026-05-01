import Link from "next/link";
import { FileText, MessageCircle, ShieldCheck } from "lucide-react";
import { SiteLogoMark } from "@/components/brand/site-logo-mark";

const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";
const vkHref = process.env.NEXT_PUBLIC_SUPPORT_VK_URL ?? "https://vk.com/efootball_nexon";

function VkIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12.785 17.58c-5.09 0-7.994-3.49-8.115-9.295H7.22c.084 4.26 1.963 6.064 3.452 6.435V8.285h2.4v3.673c1.47-.158 3.012-1.832 3.533-3.673h2.4c-.4 2.27-2.074 3.944-3.266 4.632 1.192.558 3.1 2.018 3.827 4.663h-2.64c-.567-1.767-1.98-3.135-3.854-3.321v3.321h-.287Z" />
    </svg>
  );
}

const socialLinks = [
  {
    href: telegramHref,
    label: "Telegram",
    handle: "@efootball_nexon",
    icon: <MessageCircle className="h-4 w-4" />,
    iconTone: "bg-sky-400/15 text-sky-100",
    borderTone: "hover:border-sky-300/30 hover:bg-sky-400/[0.08]",
  },
  {
    href: vkHref,
    label: "ВКонтакте",
    handle: "vk.com/efootball_nexon",
    icon: <VkIcon className="h-4 w-4" />,
    iconTone: "bg-blue-400/15 text-blue-100",
    borderTone: "hover:border-blue-300/30 hover:bg-blue-400/[0.08]",
  },
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
  { href: "/offer", label: "Публичная оферта" },
  { href: "/consent", label: "Согласие на обработку данных" },
  { href: "/cookies", label: "Политика cookie" },
];

const footerQuickLinks = [
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Пользовательское соглашение" },
  { href: "/offer", label: "Публичная оферта" },
  { href: "/contacts", label: "Контакты" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-gradient-to-b from-transparent to-white/[0.02]">
      <div className="page-shell py-4 sm:py-12">
        <div className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl sm:gap-6 sm:rounded-[2rem] sm:p-8 lg:grid-cols-[1.2fr_0.8fr_0.9fr]">
          <div className="space-y-3 sm:space-y-5">
            <div className="flex items-center gap-3">
              <SiteLogoMark className="h-9 w-9 sm:h-12 sm:w-12" />
              <div>
                <div className="font-display text-base font-thin text-white sm:text-xl">eFootball Nexon</div>
                <div className="hidden text-sm text-zinc-400 sm:block">eFootball Mobile Tournaments</div>
              </div>
            </div>

            <p className="hidden max-w-md text-sm leading-7 text-zinc-400 sm:block">
              Турнирная платформа для сезонов, сеток, результатов матчей и мобильного участия в событиях eFootball.
            </p>

            <div className="grid gap-2.5 sm:max-w-md">
              {socialLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-zinc-200 transition duration-200 ${link.borderTone}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${link.iconTone}`}>{link.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">{link.label}</span>
                      <span className="block truncate text-xs text-zinc-500 group-hover:text-zinc-300">{link.handle}</span>
                    </span>
                  </span>
                  <span className="text-xs font-medium text-zinc-500 transition group-hover:text-white">Открыть</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden space-y-2 sm:block sm:space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Навигация</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 sm:grid sm:gap-3">
              {navigationLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-xs text-zinc-300 transition hover:text-white sm:text-sm">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-2 sm:space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Документы</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 sm:grid sm:gap-3">
              {legalLinks.map((link, index) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="inline-flex items-start gap-1.5 text-xs leading-5 text-zinc-300 transition hover:text-white sm:gap-2 sm:text-sm sm:leading-6"
                >
                  {index % 2 === 0 ? (
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                  ) : (
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" />
                  )}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-3 text-xs text-zinc-500 sm:mt-6 sm:text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {footerQuickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p>eFootball Nexon © 2026. Турниры по eFootball Mobile в мобильном формате.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
