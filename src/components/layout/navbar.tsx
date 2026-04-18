import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { SiteLogoMark } from "@/components/brand/site-logo-mark";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { AuthNav } from "@/components/layout/auth-nav";

const links = [
  { href: "/", label: "Главная" },
  { href: "/regulations", label: "Регламент" },
  { href: "/tournaments", label: "Турниры" },
  { href: "/ratings", label: "Рейтинги" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
];

export async function Navbar() {
  const session = await getCurrentSession();
  const unread = session?.user ? await db.notification.count({ where: { userId: session.user.id, isRead: false } }) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0 flex items-center gap-3">
          <MobileMenu links={links} />
          <Link href="/" className="min-w-0 flex items-center gap-2 sm:gap-3">
            <SiteLogoMark idPrefix="navbar-en-logo" />
            <div className="min-w-0">
              <div className="truncate font-display text-base font-thin leading-none text-white sm:text-lg">eFootball Nexon</div>
              <div className="mt-1 hidden text-xs leading-tight text-zinc-400 sm:block">eFootball Mobile Tournaments</div>
            </div>
          </Link>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-zinc-300 hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="shrink-0 flex items-center gap-1 sm:gap-2">
          <AuthNav unread={unread} />
        </div>
      </div>
    </header>
  );
}
