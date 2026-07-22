import type { ReactNode } from "react";
import { tournamentTabIcons } from "@/components/tournaments/tournament-tab-icons";
import { TournamentTabLink } from "@/components/tournaments/tournament-tab-link";
import type { TournamentTabItem, TournamentTabValue } from "@/lib/tournament-public-view";
import { cn } from "@/lib/utils";

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
      {/* Desktop / tablet: sticky bar at the top of the content column. */}
      <nav
        className="sticky top-16 z-30 -mx-3 hidden border-y border-white/10 bg-[#080b0e]/92 px-3 py-2 backdrop-blur-xl sm:top-[72px] sm:mx-0 sm:block sm:rounded-2xl sm:border lg:top-20"
        aria-label="Разделы турнира"
      >
        <div className="overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="inline-flex min-w-max gap-1">
            {tabs.map((tab) => {
              const Icon = tournamentTabIcons[tab.value];
              const active = tab.value === initialValue;
              return (
                <TournamentTabLink
                  key={tab.value}
                  href={`?tab=${tab.value}`}
                  active={active}
                  className={cn(
                    "relative inline-flex h-11 shrink-0 snap-start items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none sm:px-4",
                    active
                      ? "border-primary/30 bg-primary/10 text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
                      : "border-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.05] hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TournamentTabLink>
              );
            })}
          </div>
        </div>
      </nav>

      {children}

      {/* Mobile: compact fixed bottom bar with custom SVG icon + small label. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#080b0e]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:hidden"
        aria-label="Разделы турнира"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-1 py-1">
          {tabs.map((tab) => {
            const Icon = tournamentTabIcons[tab.value];
            const active = tab.value === initialValue;
            return (
              <TournamentTabLink
                key={tab.value}
                href={`?tab=${tab.value}`}
                active={active}
                className={cn(
                  "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 pb-1 pt-2 text-[10px] font-semibold leading-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none",
                  active ? "text-primary" : "text-zinc-500 active:bg-white/[0.05]",
                )}
              >
                {/* Active indicator bar along the top edge of the item. */}
                <span
                  className={cn(
                    "absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary transition-opacity duration-200",
                    active ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200",
                    active ? "bg-primary/12" : "bg-transparent",
                  )}
                >
                  <Icon className="h-[22px] w-[22px] shrink-0" />
                </span>
                <span className="w-full truncate text-center">{tab.label}</span>
              </TournamentTabLink>
            );
          })}
        </div>
      </nav>

      {/* Spacer so the fixed mobile bar never covers the last content. */}
      <div className="h-[4.75rem] pb-[env(safe-area-inset-bottom)] sm:hidden" aria-hidden="true" />
    </>
  );
}
