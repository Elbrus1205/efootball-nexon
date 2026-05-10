"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, LogOut, Shield, ShieldCheck, User2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NotificationMenu } from "@/components/layout/notification-menu";

export function AuthNav({ unread = 0 }: { unread?: number }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div className="h-10 w-20 rounded-full bg-white/5 sm:w-28" />;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur">
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
          <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 p-0 hover:bg-white/5">
            <Avatar className="h-10 w-10">
              <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? "Avatar"} />
              <AvatarFallback>{(session.user.name ?? "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-3xl border-white/10 bg-[#12161f]/95 p-2 text-white backdrop-blur-xl">
          <div className="px-3 py-2">
            <div className="text-sm font-medium">{session.user.name}</div>
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

