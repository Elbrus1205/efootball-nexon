"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, Shield, ShieldCheck, User2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function AuthNav({ unread = 0 }: { unread?: number }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div className="h-11 w-28 rounded-full bg-white/5" />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur">
        <Button
          asChild
          variant="ghost"
          className="hidden h-10 rounded-xl px-4 text-zinc-200 transition hover:bg-white/10 hover:text-white hover:shadow-[0_10px_24px_rgba(255,255,255,0.06)] sm:inline-flex"
        >
          <Link href="/login">Войти</Link>
        </Button>
        <Button
          asChild
          variant="accent"
          className="h-10 rounded-xl border border-amber-200/25 bg-[linear-gradient(135deg,#ffd15a_0%,#f5a400_48%,#ff8f1f_100%)] px-4 font-semibold text-black shadow-[0_12px_30px_rgba(245,164,0,0.28),inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_16px_36px_rgba(245,164,0,0.38),inset_0_1px_0_rgba(255,255,255,0.55)] sm:px-5"
        >
          <Link href="/register">Регистрация</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-full sm:h-11 sm:w-11">
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
            {unread}
          </span>
        ) : null}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 p-0 hover:bg-white/5">
            <Avatar className="h-10 w-10">
              <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? "Avatar"} />
              <AvatarFallback>{(session.user.name ?? session.user.nickname ?? "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-3xl border-white/10 bg-[#12161f]/95 p-2 text-white backdrop-blur-xl">
          <div className="px-3 py-2">
            <div className="text-sm font-medium">{session.user.name ?? session.user.nickname}</div>
            <div className="text-xs text-zinc-500">{session.user.email ?? "Telegram/VK"}</div>
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

          {(session.user.role === "ADMIN" || session.user.role === "MODERATOR") && (
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
