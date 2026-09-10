"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, ShieldCheck } from "lucide-react";
import { SiteLogoMark } from "@/components/brand/site-logo-mark";

const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";
const vkHref = process.env.NEXT_PUBLIC_SUPPORT_VK_URL ?? "https://vk.com/efootball_nexon";

function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M21.6 4.2c.2-1-.7-1.7-1.6-1.3L2.8 9.5c-1.1.4-1 2 .1 2.3l4.4 1.4 1.7 5.2c.4 1.1 1.8 1.4 2.5.5l2.5-3 4.4 3.3c.8.6 1.9.1 2.1-.9l3.1-14.1Zm-5.9 3.4-6.5 5.8-.3 3 1.1-2.2 6.9-6.1c.4-.4-.1-.8-.6-.5Z" />
    </svg>
  );
}

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
    icon: <TelegramIcon className="h-4 w-4" />,
    iconTone: "border border-primary/40 bg-transparent text-primary",
    borderTone: "hover:border-primary/60",
  },
  {
    href: vkHref,
    label: "ВКонтакте",
    icon: <VkIcon className="h-4 w-4" />,
    iconTone: "border border-primary/40 bg-transparent text-primary",
    borderTone: "hover:border-primary/60",
  },
];

const navigationLinks = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/shop", label: "Магазин" },
  { href: "/players", label: "Пользователи" },
  { href: "/ratings", label: "Рейтинги" },
  { href: "/regulations", label: "Регламент" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
];

const legalLinks = [
  { href: "/shop/legal/rules", label: "Правила магазина" },
  { href: "/privacy", label: "Политика конфиденциальности" },
  { href: "/terms", label: "Пользовательское соглашение" },
  { href: "/consent", label: "Согласие на обработку данных" },
  { href: "/legal/cross-border", label: "Трансграничная передача данных" },
  { href: "/cookies", label: "Политика cookie" },
];

export function SiteFooter() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  return (
    <footer className={`site-footer ${isHome ? "home-footer" : ""} border-t border-[#77F8CB]/15 bg-[#0A0D0C]`}>
      <div className="page-shell py-8 sm:py-14">
        <div className="site-footer-panel relative grid gap-8 overflow-hidden rounded-[28px] border border-white/10 bg-[#101513] p-5 sm:gap-10 sm:p-9 lg:grid-cols-[1.2fr_0.8fr_0.9fr]">
          <svg className="site-footer-pitch" viewBox="0 0 420 220" fill="none" aria-hidden="true">
            <path d="M12 110h396M210 12v196M104 12v196M316 12v196M12 36h92v148H12M408 36h-92v148h92" />
            <circle cx="210" cy="110" r="42" />
          </svg>
          <div className="space-y-3 sm:space-y-5">
            <div className="relative flex items-center gap-3">
              <SiteLogoMark className="h-9 w-9 sm:h-12 sm:w-12" />
              <div>
                <div className="font-display text-base font-thin text-white sm:text-xl">eFootball Nexon</div>
                <div className="hidden text-sm text-zinc-400 sm:block">eFootball Mobile Tournaments</div>
              </div>
            </div>

            <p className="hidden max-w-md text-sm leading-7 text-zinc-400 sm:block">
              Турнирная платформа для сезонов, сеток, результатов матчей и мобильного участия в событиях eFootball.
            </p>

            <div className="flex flex-wrap gap-2 sm:max-w-md">
              {socialLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`group inline-flex w-fit items-center gap-2 rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm font-semibold text-zinc-200 transition duration-200 ${link.borderTone}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${link.iconTone}`}>{link.icon}</span>
                  <span className="text-white">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="relative hidden space-y-2 sm:block sm:space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Навигация</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 sm:grid sm:gap-3">
              {navigationLinks.map((link) => (
                <Link key={link.href} href={link.href} prefetch={false} className="text-xs text-zinc-300 transition hover:text-white sm:text-sm">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative space-y-2 sm:space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Документы</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 sm:grid sm:gap-3">
              {legalLinks.map((link, index) => (
                <Link
                  key={link.label}
                  href={link.href}
                  prefetch={false}
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

        <div className="mt-4 flex flex-col gap-3 text-xs text-zinc-500 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
          <div className="sm:flex sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p>eFootball Nexon © 2026. Турниры по eFootball Mobile в мобильном формате.</p>
          </div>
          <span className="footer-edition">NEX / 2026</span>
        </div>
      </div>
    </footer>
  );
}
