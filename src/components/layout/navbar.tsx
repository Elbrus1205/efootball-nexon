import Link from "next/link";
import { Bell, Shield, Trophy } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NotificationMenu } from "@/components/layout/notification-menu";

const links = [
  { href: "/", label: "Главная" },
  { href: "/regulations", label: "Регламент" },
  { href: "/tournaments", label: "Турниры" },
  { href: "/faq", label: "FAQ" },
  { href: "/contacts", label: "Контакты" },
];

export async function Navbar() {
  const session = await getCurrentSession();
  const unread = session?.user ? await db.notification.count({ where: { userId: session.user.id, isRead: false } }) : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <MobileMenu links={links} />
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold text-white">eFootTourney</div>
              <div className="text-xs text-zinc-400">Mobile eFootball Portal</div>
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

        <div className="flex items-center gap-2">
          {session?.user ? (
            <>
              <NotificationMenu unreadCount={unread} userId={session.user.id}>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unread > 0 ? (
                    <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
                      {unread}
                    </span>
                  ) : null}
                </Button>
              </NotificationMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-full border border-white/10 px-2 py-1 hover:bg-white/5">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? "Avatar"} />
                      <AvatarFallback>{session.user.name}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-3 py-2">
                    <div className="text-sm font-medium">{session.user.nickname ?? session.user.name}</div>
                    <div className="text-xs text-zinc-500">{session.user.email ?? "Telegram/VK"}</div>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">Личный кабинет</Link>
                  </DropdownMenuItem>
                  {(session.user.role === "ADMIN" || session.user.role === "MODERATOR") && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Админ-панель
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/api/auth/signout">Выйти</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Войти</Link>
              </Button>
              <Button asChild variant="accent">
                <Link href="/register">Регистрация</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
