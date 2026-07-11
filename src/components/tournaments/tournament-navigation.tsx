"use client";

import { Braces, CalendarDays, Gamepad2, ScrollText, ShieldCheck, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TournamentTabItem, TournamentTabValue } from "@/lib/tournament-public-view";
import { isTournamentTabValue } from "@/lib/tournament-public-view";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const availableValues = useMemo(() => tabs.map((tab) => tab.value), [tabs]);
  const urlTab = searchParams.get("tab");

  useEffect(() => {
    const next = isTournamentTabValue(urlTab) && availableValues.includes(urlTab) ? urlTab : initialValue;
    setValue(next);
  }, [urlTab, initialValue, availableValues]);

  const changeTab = (next: string) => {
    if (!isTournamentTabValue(next)) return;
    setValue(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    if (next !== "participants") params.delete("participantSearch");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={value} onValueChange={changeTab}>
      <div className="sticky top-16 z-30 -mx-3 border-y border-white/10 bg-[#080b0e]/92 px-3 py-2 backdrop-blur-xl sm:top-[72px] sm:mx-0 sm:rounded-2xl sm:border lg:top-20">
        <div className="overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList aria-label="Разделы турнира" className="inline-flex min-w-max gap-1 border-0 bg-transparent p-0">
            {tabs.map((tab) => {
              const Icon = icons[tab.value];
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className={cn(
                    "relative h-11 shrink-0 snap-start gap-2 rounded-xl border border-transparent px-3 text-sm font-semibold text-zinc-400 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none sm:px-4",
                    "hover:border-white/10 hover:bg-white/[0.05] hover:text-white data-[state=active]:border-primary/30 data-[state=active]:bg-primary/10 data-[state=active]:text-white",
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-primary after:transition-transform data-[state=active]:after:scale-x-100 motion-reduce:after:transition-none",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </div>
      {children}
    </Tabs>
  );
}
