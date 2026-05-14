import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { SiteLogoMark } from "@/components/brand/site-logo-mark";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { AuthNav } from "@/components/layout/auth-nav";
import { DesktopNav } from "@/components/layout/desktop-nav";

const links = [
  { href: "/", label: "Главная" },
  { href: "/regulations", label: "Регламент" },
  { href: "/tournaments", label: "Турниры" },
  { href: "/players", label: "Пользователи" },
  { href: "/coins/services", label: "Coins" },
  { href: "/ratings", label: "Рейтинги" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
];

export async function Navbar() {
  const session = await getCurrentSession();
  const unread = session?.user ? await db.notification.count({ where: { userId: session.user.id, isRead: false } }) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[linear-gradient(180deg,rgba(4,8,16,0.9),rgba(6,10,18,0.72))] shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_18%_0%,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_82%_0%,rgba(245,158,11,0.1),transparent_32%)]" />
      <div className="relative mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-2 px-3 sm:h-20 sm:gap-3 sm:px-6 lg:px-8">
        <div className="min-w-0 flex flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
          <MobileMenu links={links} />
          <Link href="/" aria-label="eFootball Nexon" className="brand-link group min-w-0 flex-1 items-center gap-2 rounded-2xl py-1 pr-2 outline-none transition duration-300 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/70 sm:flex-none sm:gap-3">
            <span className="relative">
              <span className="absolute inset-0 rounded-2xl bg-sky-400/10 blur-xl opacity-0 transition duration-300 group-hover:opacity-100" />
              <SiteLogoMark />
            </span>
            <div className="min-w-0 max-w-[152px] sm:max-w-none">
              <div className="brand-wordmark truncate font-display text-base font-thin leading-none text-white min-[390px]:text-lg sm:text-xl">eFootball Nexon</div>
              <div className="mt-1 hidden items-center gap-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.22em] text-sky-100/70 sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" />
                Mobile Tournaments
              </div>
            </div>
          </Link>
        </div>

        <div className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
          <DesktopNav links={links} />
        </div>

        <div className="shrink-0 flex items-center gap-1 sm:gap-2">
          <AuthNav unread={unread} />
        </div>
      </div>
    </header>
  );
}
