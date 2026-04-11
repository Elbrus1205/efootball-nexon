"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Панель", icon: LayoutDashboard },
  { href: "/admin/tournaments", label: "Турниры", icon: Trophy },
  { href: "/admin/users", label: "Участники", icon: Users },
  { href: "/admin/matches", label: "Матчи", icon: Swords },
  { href: "/admin/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/admin/moderation", label: "Споры", icon: ShieldCheck },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="max-w-full overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max gap-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition",
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
    </div>
  );
}
