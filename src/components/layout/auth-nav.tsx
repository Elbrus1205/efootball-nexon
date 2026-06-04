"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, LogIn, LogOut, Shield, ShieldCheck, User2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationMenu } from "@/components/layout/notification-menu";

export function AuthNav({ unread = 0 }: { unread?: number }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div className="h-11 w-11 rounded-2xl border border-white/10 bg-white/5 sm:w-28" />;
  }

  if (!session?.user) {
    return (
      <>
        <Link
          href="/register"
          aria-label="Регистрация"
          className="group relative inline-flex h-10 items-center justify-center overflow-hidden rounded-xl border border-[#b9944f]/25 bg-white/[0.035] px-3 text-xs font-bold text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-0.5 hover:border-[#b9944f]/45 hover:bg-[#b9944f]/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9944f]/60 sm:hidden"
        >
          <span className="absolute inset-x-2 bottom-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-[#b9944f]/80 to-transparent transition duration-300 group-hover:scale-x-100" />
          Регистрация
        </Link>

        <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_34px_rgba(2,6,23,0.18)] backdrop-blur sm:flex">
          <Button
            asChild
            variant="ghost"
            aria-label="Войти"
            className="h-9 rounded-full px-3 text-sm font-bold text-zinc-200 transition duration-300 hover:bg-white/[0.07] hover:text-white"
          >
            <Link href="/login">
              <LogIn className="mr-1.5 h-4 w-4" />
              Войти
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            aria-label="Регистрация"
            className="group h-9 rounded-full border border-[#b9944f]/25 bg-[#b9944f]/10 px-3 text-sm font-bold text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:border-[#b9944f]/45 hover:bg-[#b9944f]/16 hover:text-white"
          >
            <Link href="/register">
              Регистрация
              <span className="ml-1 inline-block transition duration-300 group-hover:translate-x-0.5">→</span>
            </Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <NotificationMenu userId={session.user.id} unreadCount={unread}>
        <Bell className="h-5 w-5" />
      </NotificationMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(0,0,0,0.26)] transition duration-300 hover:-translate-y-0.5 hover:border-[#b9944f]/30 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9944f]/60 sm:h-12 sm:w-12">
            <span className="absolute inset-0 rounded-2xl bg-[#b9944f]/10 opacity-0 blur-md transition duration-300 group-hover:opacity-100" />
            <Avatar className="relative h-9 w-9 rounded-xl border border-white/10 sm:h-10 sm:w-10">
              <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? "Avatar"} />
              <AvatarFallback>{(session.user.name ?? "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 rounded-3xl border-white/10 bg-[#0b111d]/95 p-2 text-white shadow-[0_24px_70px_rgba(2,6,23,0.48)] backdrop-blur-2xl">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <div className="text-sm font-bold">{session.user.name}</div>
          </div>

          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="flex items-center gap-2">
              <User2 className="h-4 w-4" />
              Профиль
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/dashboard/security" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Безопасность
            </Link>
          </DropdownMenuItem>

          {["FOUNDER", "ORGANIZER", "ADMIN", "JUDGE", "TRAINEE"].includes(session.user.role) && (
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Админ-панель
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onSelect={async () => {
              await signOut({ redirect: false });
              router.refresh();
              router.push("/");
            }}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

