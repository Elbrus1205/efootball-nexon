import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
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
    <header className="mobile-premium-header sticky top-0 z-40 overflow-visible border-b border-sky-200/10 bg-[radial-gradient(circle_at_50%_-18%,rgba(56,189,248,0.2),transparent_42%),linear-gradient(180deg,rgba(3,7,18,0.94),rgba(7,12,23,0.88))] shadow-[0_18px_54px_rgba(0,0,0,0.3)] backdrop-blur-2xl lg:bg-[radial-gradient(circle_at_16%_35%,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_84%_28%,rgba(245,158,11,0.1),transparent_30%),linear-gradient(180deg,rgba(4,8,16,0.94),rgba(6,10,18,0.86))]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-300/55 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(14,165,233,0.08),transparent_32%,transparent_68%,rgba(56,189,248,0.06))]" />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-6 lg:h-20 lg:px-8">
        <div className="min-w-0 flex flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
          <MobileMenu links={links} />
          <Link href="/" aria-label="eFootball Nexon" className="brand-link group min-w-0 items-center rounded-xl px-1.5 py-1 outline-none transition duration-300 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary/70 lg:flex-none lg:pr-2">
            <div className="min-w-0 max-w-[142px] min-[390px]:max-w-[168px] sm:max-w-none">
              <div className="brand-wordmark truncate text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-white transition duration-300 group-hover:text-sky-50 min-[390px]:text-xs sm:text-sm lg:font-display lg:text-xl lg:font-thin lg:normal-case lg:tracking-normal">
                <span className="lg:hidden">EFOOTBALL NEXON</span>
                <span className="hidden lg:inline">eFootball Nexon</span>
              </div>
              <div className="mt-1 hidden items-center gap-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.22em] text-sky-100/70 lg:flex">
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
