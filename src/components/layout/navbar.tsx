import Link from "next/link";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { AuthNav } from "@/components/layout/auth-nav";
import { DesktopNav } from "@/components/layout/desktop-nav";

const links = [
  { href: "/", label: "Главная" },
  { href: "/regulations", label: "Регламент" },
  { href: "/tournaments", label: "Турниры" },
  { href: "/shop", label: "Магазин" },
  { href: "/players", label: "Пользователи" },
  { href: "/ratings", label: "Рейтинги" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
];

export function Navbar() {
  return (
    <header className="mobile-premium-header sticky top-0 z-40 overflow-visible border-b border-[#77F8CB]/15 bg-[#171717]/95 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[#21F1A8]/70 to-transparent" />
      <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-6 lg:h-20 lg:px-8">
        <div className="min-w-0 flex flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
          <MobileMenu links={links} />
          <Link href="/" prefetch={false} aria-label="eFootball Nexon" className="brand-link group min-w-0 items-center rounded-lg px-1.5 py-1 outline-none transition duration-200 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#77F8CB] lg:flex-none lg:pr-2">
            <div className="min-w-0 max-w-[142px] min-[390px]:max-w-[168px] sm:max-w-none">
              <div className="brand-wordmark truncate text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-white transition duration-300 group-hover:text-zinc-100 min-[390px]:text-xs sm:text-sm lg:font-display lg:text-xl lg:font-thin lg:normal-case lg:tracking-normal">
                <span className="lg:hidden">EFOOTBALL NEXON</span>
                <span className="hidden lg:inline">eFootball Nexon</span>
              </div>
              <div className="mt-1 hidden items-center gap-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.22em] text-[#a7b7cc] lg:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#21F1A8] shadow-[0_0_12px_rgba(33,241,168,0.45)]" />
                Mobile Tournaments
              </div>
            </div>
          </Link>
        </div>

        <div className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
          <DesktopNav links={links} />
        </div>

        <div className="shrink-0 flex items-center gap-1 sm:gap-2">
          <AuthNav />
        </div>
      </div>
    </header>
  );
}
