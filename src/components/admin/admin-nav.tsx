"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tournaments", label: "Турниры", icon: Trophy },
  { href: "/admin/users", label: "Участники и роли", icon: Users },
  { href: "/admin/matches", label: "Матчи", icon: Swords },
  { href: "/admin/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/admin/moderation", label: "Результаты", icon: ShieldCheck },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap transition",
              active
                ? "border-primary/30 bg-primary/10 text-white shadow-[0_0_24px_rgba(59,130,246,0.14)]"
                : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-primary/20 hover:text-white",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
