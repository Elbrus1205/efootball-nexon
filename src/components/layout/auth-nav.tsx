"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function AuthNav({ unread = 0 }: { unread?: number }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div className="h-11 w-28 rounded-full bg-white/5" />;
  }

  if (!session?.user) {
    return (
      <>
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link href="/login">Войти</Link>
        </Button>
        <Button asChild variant="accent">
          <Link href="/register">Регистрация</Link>
        </Button>
      </>
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
            <Avatar className="h-10 w-10 sm:h-10 sm:w-10">
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
            <Link href="/dashboard">Профиль</Link>
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
