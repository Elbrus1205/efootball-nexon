"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  BarChart3,
  CircleHelp,
  Coins,
  FileText,
  Home,
  LogIn,
  Phone,
  Users,
  Trophy,
  User2,
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
  "/players": { icon: Users, caption: "Игроки сайта" },
  "/coins": { icon: Coins, caption: "Магазин Coins" },
  "/coins/services": { icon: Coins, caption: "Услуги и донат Coins" },
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
  const [menuPosition, setMenuPosition] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { data: session } = useSession();

  function updateMenuPosition() {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gap = 10;
    const edgeGap = 12;
    const visualViewport = window.visualViewport;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const spaceBelow = viewportBottom - rect.bottom - gap - edgeGap;
    const spaceAbove = rect.top - viewportTop - gap - edgeGap;
    const openBelow = spaceBelow >= 300 || spaceBelow >= spaceAbove;

    setMenuPosition(
      openBelow
        ? {
            top: rect.bottom + gap,
            maxHeight: Math.max(220, spaceBelow),
          }
        : {
            bottom: viewportBottom - rect.top + gap,
            maxHeight: Math.max(220, spaceAbove),
          },
    );
  }

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    updateMenuPosition();

    const handleViewportChange = () => updateMenuPosition();
    const handleScroll = () => setOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-controls="mobile-navigation"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        onClick={() => {
          updateMenuPosition();
          setOpen((value) => !value);
        }}
        className={cn(
          "group relative z-[80] flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(2,6,23,0.2)] backdrop-blur-xl transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
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
        className={cn("fixed inset-0 z-[200] lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!open}
      >
        <div
          className={cn("absolute inset-0 bg-black/0 backdrop-blur-0 transition duration-300", open && "bg-black/35 backdrop-blur-[2px]")}
          onClick={() => setOpen(false)}
        />

        <div
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Мобильная навигация"
          style={menuPosition}
          className={cn(
            "fixed left-3 right-3 flex origin-top flex-col overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.14),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.97),rgba(6,10,18,0.96))] shadow-[0_24px_70px_rgba(2,6,23,0.46),0_0_0_1px_rgba(148,163,184,0.06)] backdrop-blur-2xl transition-[transform,opacity,filter] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:left-4 sm:right-4",
            open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-3 scale-[0.985] opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/65 to-transparent" />
          {!session?.user ? (
            <div className="relative border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-400/10 text-amber-100 shadow-[0_0_28px_rgba(245,158,11,0.14)]">
                  <User2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">eFootball Nexon</div>
                  <div className="mt-0.5 text-xs font-medium text-zinc-400">Войдите, чтобы играть в турнирах</div>
                </div>
              </div>
            </div>
          ) : null}

          <nav className="relative flex-1 overflow-y-auto px-2 py-4">
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
                      "hover:bg-white/[0.055] hover:text-white active:scale-[0.985]",
                      open && "animate-mobile-menu-item",
                      active &&
                        "bg-sky-400/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.24),0_10px_24px_rgba(2,6,23,0.16)]",
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

          {!session?.user ? (
            <div className="border-t border-white/10 p-3">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-bold text-white transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  <LogIn className="h-4 w-4 text-sky-200" />
                  Войти
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="registration-cta flex min-h-12 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 text-sm font-black text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                >
                  Регистрация
                </Link>
              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
