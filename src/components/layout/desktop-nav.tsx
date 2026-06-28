"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type DesktopNavLink = {
  href: string;
  label: string;
};

export function DesktopNav({ links }: { links: DesktopNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Основная навигация" className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_48px_rgba(2,6,23,0.22)] backdrop-blur-2xl lg:flex">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative isolate overflow-hidden rounded-full px-3.5 py-2 text-[13px] font-bold leading-none text-zinc-300 transition-[color,background-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9944f]/60 xl:px-4",
              active && "bg-[#b9944f]/12 text-white shadow-[inset_0_0_0_1px_rgba(185,148,79,0.3),0_0_24px_rgba(185,148,79,0.14)]",
            )}
          >
            <span className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 rounded-full bg-gradient-to-r from-transparent via-[#b9944f] to-transparent opacity-0 transition duration-300 group-hover:scale-x-100 group-hover:opacity-80" />
            <span className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(185,148,79,0.16),transparent_62%)] opacity-0 transition duration-300 group-hover:opacity-100" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
