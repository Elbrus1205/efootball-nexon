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
      <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_14px_34px_rgba(2,6,23,0.18)] backdrop-blur sm:flex">
        <Button
          asChild
          variant="ghost"
          aria-label="Войти"
          className="h-9 rounded-full px-3 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.07] hover:text-white"
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
          className="registration-cta h-9 rounded-full border border-amber-300/35 bg-[linear-gradient(135deg,rgba(18,27,42,0.98),rgba(15,19,28,0.98)_48%,rgba(70,47,10,0.94)_100%)] px-2.5 font-black text-amber-100 shadow-[0_12px_32px_rgba(245,158,11,0.18),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[linear-gradient(135deg,rgba(28,41,62,0.98),rgba(20,26,38,0.98)_48%,rgba(92,61,12,0.96)_100%)] hover:text-white sm:px-3"
        >
          <Link href="/register">
            <span className="hidden min-[390px]:inline">Регистрация</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <NotificationMenu userId={session.user.id} unreadCount={unread}>
        <Bell className="h-5 w-5" />
      </NotificationMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_30px_rgba(2,6,23,0.2)] transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:h-12 sm:w-12">
            <span className="absolute inset-0 rounded-2xl bg-sky-400/10 opacity-0 blur-md transition duration-300 group-hover:opacity-100" />
            <Avatar className="relative h-9 w-9 rounded-xl border border-white/10 sm:h-10 sm:w-10">
              <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? "Avatar"} />
              <AvatarFallback>{(session.user.name ?? "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 rounded-3xl border-white/10 bg-[#0b111d]/95 p-2 text-white shadow-[0_24px_70px_rgba(2,6,23,0.48)] backdrop-blur-2xl">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
            <div className="text-sm font-bold">{session.user.name}</div>
            <div className="mt-0.5 text-xs text-sky-100/55">eFootball Nexon аккаунт</div>
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

          {["FOUNDER", "ORGANIZER", "ADMIN", "JUDGE"].includes(session.user.role) && (
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

