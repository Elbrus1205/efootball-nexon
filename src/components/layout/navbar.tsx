import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifyExpiredProfileStatuses } from "@/lib/profile-statuses";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { AuthNav } from "@/components/layout/auth-nav";
import { DesktopNav } from "@/components/layout/desktop-nav";

const links = [
  { href: "/", label: "Главная" },
  { href: "/regulations", label: "Регламент" },
  { href: "/tournaments", label: "Турниры" },
  { href: "/players", label: "Пользователи" },
  { href: "/ratings", label: "Рейтинги" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
];

export async function Navbar() {
  const session = await getCurrentSession();
  if (session?.user) {
    await notifyExpiredProfileStatuses({ userId: session.user.id });
  }
  const unread = session?.user ? await db.notification.count({ where: { userId: session.user.id, isRead: false } }) : 0;

  return (
    <header className="mobile-premium-header sticky top-0 z-40 overflow-visible border-b border-white/[0.07] bg-[radial-gradient(circle_at_50%_-30%,rgba(52,72,92,0.28),transparent_48%),linear-gradient(180deg,rgba(8,9,10,0.82),rgba(4,5,6,0.66))] shadow-[0_18px_54px_rgba(0,0,0,0.34)] backdrop-blur-2xl lg:bg-[radial-gradient(circle_at_16%_20%,rgba(52,72,92,0.24),transparent_34%),radial-gradient(circle_at_84%_24%,rgba(185,148,79,0.12),transparent_28%),linear-gradient(180deg,rgba(8,9,10,0.84),rgba(4,5,6,0.7))]">
      <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[#b9944f]/45 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035),transparent_34%,transparent_70%,rgba(185,148,79,0.035))]" />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-6 lg:h-20 lg:px-8">
        <div className="min-w-0 flex flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
          <MobileMenu links={links} />
          <Link href="/" aria-label="eFootball Nexon" className="brand-link group min-w-0 items-center rounded-xl px-1.5 py-1 outline-none transition duration-300 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[#b9944f]/60 lg:flex-none lg:pr-2">
            <div className="min-w-0 max-w-[142px] min-[390px]:max-w-[168px] sm:max-w-none">
              <div className="brand-wordmark truncate text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-white transition duration-300 group-hover:text-zinc-100 min-[390px]:text-xs sm:text-sm lg:font-display lg:text-xl lg:font-thin lg:normal-case lg:tracking-normal">
                <span className="lg:hidden">EFOOTBALL NEXON</span>
                <span className="hidden lg:inline">eFootball Nexon</span>
              </div>
              <div className="mt-1 hidden items-center gap-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.22em] text-zinc-400 lg:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b9944f] shadow-[0_0_12px_rgba(185,148,79,0.45)]" />
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
