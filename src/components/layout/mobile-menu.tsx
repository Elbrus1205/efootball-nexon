"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CircleHelp,
  Coins,
  FileText,
  Home,
  Phone,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type MobileMenuLink = {
  href: string;
  label: string;
};

const linkMeta: Record<string, { icon: LucideIcon; caption: string }> = {
  "/": { icon: Home, caption: "Главная сцена" },
  "/regulations": { icon: FileText, caption: "Правила и формат" },
  "/tournaments": { icon: Trophy, caption: "Ближайшие турниры" },
  "/coins": { icon: Coins, caption: "Магазин Coins" },
  "/ratings": { icon: BarChart3, caption: "Таблица игроков" },
  "/faq": { icon: CircleHelp, caption: "Ответы и помощь" },
  "/contacts": { icon: Phone, caption: "Связь с нами" },
};

const fallbackMeta = {
  icon: ArrowRight,
  caption: "Раздел сайта",
};

export function MobileMenu({ links }: { links: MobileMenuLink[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const activeLink = useMemo(
    () =>
      links.find((link) => (link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href))) ??
      links[0] ??
      null,
    [links, pathname],
  );

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const overflow = open ? "hidden" : "";
    document.documentElement.style.overflow = overflow;
    document.body.style.overflow = overflow;

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-controls="mobile-navigation"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "group relative z-50 flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(2,6,23,0.16)] backdrop-blur-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
          open &&
            "border-primary/35 bg-primary/12 shadow-[0_0_0_1px_rgba(59,130,246,0.14),0_18px_44px_rgba(15,23,42,0.34),inset_0_1px_0_rgba(255,255,255,0.14)]",
        )}
      >
        <span className="pointer-events-none absolute inset-[1px] rounded-[15px] bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.16),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent)] opacity-80" />
        <span className="relative h-5 w-5">
          <span
            className={cn(
              "absolute left-0 top-0.5 h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out",
              open ? "translate-y-[7px] rotate-45" : "",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-[8px] h-0.5 w-5 rounded-full bg-current/90 transition-all duration-200 ease-out",
              open ? "scale-x-0 opacity-0" : "",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-[15px] h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out",
              open ? "-translate-y-[7px] -rotate-45" : "",
            )}
          />
        </span>
      </button>

      <div
        className={cn("fixed inset-0 z-40 md:hidden", open ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-[#020617]/0 transition-[background-color,backdrop-filter] duration-300 ease-out",
            open && "bg-[#020617]/72 backdrop-blur-md",
          )}
          onClick={() => setOpen(false)}
        />

        <div
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Мобильная навигация"
          className={cn(
            "absolute inset-y-3 left-3 right-12 top-[5rem] flex max-w-[23rem] origin-top-left flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#060a14]/96 shadow-[0_24px_80px_rgba(2,6,23,0.58),0_0_0_1px_rgba(125,211,252,0.08)] backdrop-blur-2xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:right-auto sm:w-[23rem]",
            open ? "translate-x-0 translate-y-0 opacity-100" : "-translate-x-8 -translate-y-2 opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/65 to-transparent" />
          <div className="absolute -left-12 top-8 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute -right-14 top-0 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute bottom-0 left-8 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-4 pb-4 pt-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.24em] text-sky-200/60">Навигация</div>
              <div className="mt-2 text-lg font-semibold text-white">Меню</div>
              <div className="mt-1 text-sm text-zinc-400">
                {activeLink ? `Сейчас: ${activeLink.label}` : "Разделы сайта"}
              </div>
            </div>

            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-300 transition duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="relative flex-1 overflow-y-auto px-2 py-3">
            <div className="flex flex-col gap-1.5">
              {links.map((link, index) => {
                const active = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
                const meta = linkMeta[link.href] ?? fallbackMeta;
                const Icon = meta.icon;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "group flex min-h-[60px] items-center gap-3 overflow-hidden rounded-[1.4rem] px-3.5 py-3 text-zinc-200 transition-[background-color,transform,color,box-shadow,border-color] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                      "hover:bg-white/[0.05] hover:text-white active:scale-[0.985]",
                      open && "animate-mobile-menu-item",
                      active &&
                        "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.24),0_14px_30px_rgba(2,6,23,0.18)]",
                    )}
                    style={{ animationDelay: `${100 + index * 46}ms` }}
                    onClick={() => setOpen(false)}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-zinc-300 transition duration-300",
                        active
                          ? "border-sky-300/18 bg-sky-400/12 text-sky-100 shadow-[0_10px_28px_rgba(56,189,248,0.12)]"
                          : "border-white/10 bg-white/[0.03] group-hover:border-white/15 group-hover:bg-white/[0.07] group-hover:text-white",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{link.label}</span>
                      <span className={cn("mt-0.5 block text-xs", active ? "text-sky-100/70" : "text-zinc-500 group-hover:text-zinc-400")}>
                        {meta.caption}
                      </span>
                    </span>

                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300",
                        active ? "bg-sky-400/12 text-sky-100" : "text-white/30 group-hover:bg-white/[0.06] group-hover:text-white/75",
                      )}
                    >
                      <ArrowRight className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="relative border-t border-white/10 px-4 py-4">
            <div className="flex items-center justify-between rounded-[1.4rem] border border-white/10 bg-white/[0.03] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">eFootball Nexon</div>
                <div className="mt-1 text-xs text-zinc-500">Турниры, рейтинг и профиль в одном месте</div>
              </div>
              <span className="ml-4 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.8)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
