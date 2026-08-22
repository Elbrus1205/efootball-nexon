"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  Badge,
  CalendarRange,
  CircleHelp,
  FileText,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Megaphone,
  ShoppingBag,
  SlidersHorizontal,
  ShieldCheck,
  ShieldMinus,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/tournaments", label: "Турниры", icon: Trophy },
  { href: "/admin/seasons", label: "Сезоны", icon: CalendarRange },
  { href: "/admin/statuses", label: "Статусы", icon: Award },
  { href: "/admin/regulations", label: "Регламент", icon: FileText },
  { href: "/admin/faq", label: "FAQ", icon: CircleHelp },
  { href: "/admin/clubs", label: "Клубы", icon: Badge },
  { href: "/admin/users", label: "Участники", icon: Users },
  { href: "/admin/role-permissions", label: "Права ролей", icon: SlidersHorizontal },
  { href: "/admin/matches", label: "Матчи", icon: Swords },
  { href: "/admin/moderation", label: "Споры", icon: ShieldCheck },
  { href: "/admin/reliability", label: "Надежность", icon: ShieldMinus },
  { href: "/admin/divisions", label: "Дивизион", icon: Layers3 },
  { href: "/admin/broadcasts", label: "Рассылки", icon: Megaphone },
  { href: "/admin/shop", label: "Магазин", icon: ShoppingBag },
];

export function AdminNav({ allowedHrefs }: { allowedHrefs: string[] }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const element = scrollRef.current;
    if (!element) return;

    setCanScrollLeft(element.scrollLeft > 4);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();

    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      element.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [allowedHrefs]);

  const scrollByPage = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  };

  return (
    <div className="relative max-w-full">
      <button
        type="button"
        aria-label="Прокрутить меню влево"
        disabled={!canScrollLeft}
        onClick={() => scrollByPage(-1)}
        className={cn(
          "absolute left-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-zinc-950/90 text-white shadow-[0_0_20px_rgba(0,0,0,0.35)] transition lg:flex",
          canScrollLeft ? "opacity-100 hover:border-primary/30 hover:text-primary" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={scrollRef}
        onWheel={(event) => {
          const element = scrollRef.current;
          if (!element || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

          const canMove =
            (event.deltaY < 0 && element.scrollLeft > 0) ||
            (event.deltaY > 0 && element.scrollLeft + element.clientWidth < element.scrollWidth);
          if (!canMove) return;

          event.preventDefault();
          element.scrollLeft += event.deltaY;
        }}
        className="max-w-full overflow-x-auto overscroll-x-contain px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="inline-flex min-w-max gap-2">
          {items.filter((item) => allowedHrefs.includes(item.href)).map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition",
                  active
                    ? "border-primary/30 bg-primary/10 text-white shadow-[0_0_24px_rgba(33,241,168,0.14)]"
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

      <button
        type="button"
        aria-label="Прокрутить меню вправо"
        disabled={!canScrollRight}
        onClick={() => scrollByPage(1)}
        className={cn(
          "absolute right-0 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-zinc-950/90 text-white shadow-[0_0_20px_rgba(0,0,0,0.35)] transition lg:flex",
          canScrollRight ? "opacity-100 hover:border-primary/30 hover:text-primary" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
