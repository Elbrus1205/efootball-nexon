"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        aria-expanded={open}
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative z-50 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-xl transition duration-300 hover:bg-white/[0.09]",
          open && "border-primary/40 bg-primary/15 shadow-[0_0_26px_rgba(59,130,246,0.26),inset_0_1px_0_rgba(255,255,255,0.16)]",
        )}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.16),transparent_36%)]" />
        <span className="relative flex h-5 w-5 flex-col items-center justify-center gap-1.5">
          <span
            className={cn(
              "block h-0.5 w-5 rounded-full bg-white transition duration-300",
              open && "translate-y-2 rotate-45 bg-white",
            )}
          />
          <span
            className={cn(
              "block h-0.5 w-4 rounded-full bg-white/85 transition duration-200",
              open && "scale-x-0 opacity-0",
            )}
          />
          <span
            className={cn(
              "block h-0.5 w-5 rounded-full bg-white transition duration-300",
              open && "-translate-y-2 -rotate-45 bg-white",
            )}
          />
        </span>
      </Button>

      <div
        className={cn(
          "fixed inset-x-0 top-20 z-40 h-[calc(100dvh-5rem)] overflow-hidden bg-black/0 backdrop-blur-0 transition duration-300",
          open ? "pointer-events-auto bg-black/55 backdrop-blur-sm" : "pointer-events-none",
        )}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      >
        <div
          className={cn(
            "mx-4 mt-3 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#070b13]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(59,130,246,0.12)] backdrop-blur-2xl transition duration-300 ease-out",
            open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-5 scale-[0.98] opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-16 left-6 h-36 w-36 rounded-full bg-accent/10 blur-3xl" />

            <div className="relative px-3 py-4">
              <nav className="flex flex-col gap-1.5">
                {links.map((link, index) => {
                  const active = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "group flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-zinc-200 transition duration-200",
                        "hover:bg-white/[0.07] hover:text-white active:scale-[0.985]",
                        open && "animate-mobile-menu-item",
                        active && "bg-primary/15 text-white shadow-[inset_0_0_0_1px_rgba(59,130,246,0.22)]",
                      )}
                      style={{ animationDelay: `${90 + index * 45}ms` }}
                      onClick={() => setOpen(false)}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full bg-white/25 transition duration-200 group-hover:bg-primary",
                            active && "bg-primary shadow-[0_0_16px_rgba(59,130,246,0.9)]",
                          )}
                        />
                        <span className="truncate">{link.label}</span>
                      </span>
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-white/25 transition duration-200 group-hover:translate-x-1 group-hover:text-white/70",
                          active && "text-primary",
                        )}
                      />
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
