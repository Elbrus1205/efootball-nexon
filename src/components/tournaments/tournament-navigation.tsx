import { Braces, CalendarDays, Gamepad2, ScrollText, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { TournamentTabItem, TournamentTabValue } from "@/lib/tournament-public-view";
import { cn } from "@/lib/utils";

const icons = {
  structure: Braces,
  matches: CalendarDays,
  "my-matches": Gamepad2,
  roster: ShieldCheck,
  participants: Users,
  rules: ScrollText,
} satisfies Record<TournamentTabValue, typeof Braces>;

export function TournamentNavigation({
  tabs,
  initialValue,
  children,
}: {
  tabs: TournamentTabItem[];
  initialValue: TournamentTabValue;
  children: ReactNode;
}) {
  return (
    <>
      <nav className="sticky top-16 z-30 -mx-3 border-y border-white/10 bg-[#080b0e]/92 px-3 py-2 backdrop-blur-xl sm:top-[72px] sm:mx-0 sm:rounded-2xl sm:border lg:top-20" aria-label="Разделы турнира">
        <div className="overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max gap-1">
            {tabs.map((tab) => {
              const Icon = icons[tab.value];
              const active = tab.value === initialValue;
              return (
                <Link
                  key={tab.value}
                  href={`?tab=${tab.value}`}
                  prefetch={false}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-11 shrink-0 snap-start items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none sm:px-4",
                    active
                      ? "border-primary/30 bg-primary/10 text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                      : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      {children}
    </>
  );
}
