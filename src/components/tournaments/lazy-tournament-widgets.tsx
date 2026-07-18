"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BracketView as BracketViewComponent } from "@/components/tournaments/bracket-view";
import type { MyMatchCard as MyMatchCardComponent } from "@/components/tournaments/my-match-card";
import type { RosterManager as RosterManagerComponent } from "@/components/tournaments/roster-manager";
import type { TournamentScheduleView as TournamentScheduleViewComponent } from "@/components/tournaments/tournament-schedule-view";
import type { TournamentStageSwitcher as TournamentStageSwitcherComponent } from "@/components/tournaments/tournament-stage-switcher";

function WidgetLoading() {
  return <div className="min-h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.025] motion-reduce:animate-none" aria-label="Загрузка раздела" />;
}

const BracketView = dynamic(() => import("@/components/tournaments/bracket-view").then((module) => module.BracketView), {
  ssr: false,
  loading: WidgetLoading,
});
const MyMatchCard = dynamic(() => import("@/components/tournaments/my-match-card").then((module) => module.MyMatchCard), {
  ssr: false,
  loading: WidgetLoading,
});
const RosterManager = dynamic(() => import("@/components/tournaments/roster-manager").then((module) => module.RosterManager), {
  ssr: false,
  loading: WidgetLoading,
});
const TournamentScheduleView = dynamic(
  () => import("@/components/tournaments/tournament-schedule-view").then((module) => module.TournamentScheduleView),
  { ssr: false, loading: WidgetLoading },
);
const TournamentStageSwitcher = dynamic(
  () => import("@/components/tournaments/tournament-stage-switcher").then((module) => module.TournamentStageSwitcher),
  { ssr: false, loading: WidgetLoading },
);

export function LazyBracketView(props: ComponentProps<typeof BracketViewComponent>) {
  return <BracketView {...props} />;
}

export function LazyMyMatchCard(props: ComponentProps<typeof MyMatchCardComponent>) {
  return <MyMatchCard {...props} />;
}

export function LazyRosterManager(props: ComponentProps<typeof RosterManagerComponent>) {
  return <RosterManager {...props} />;
}

export function LazyTournamentScheduleView(props: ComponentProps<typeof TournamentScheduleViewComponent>) {
  return <TournamentScheduleView {...props} />;
}

export function LazyTournamentStageSwitcher(props: ComponentProps<typeof TournamentStageSwitcherComponent>) {
  return <TournamentStageSwitcher {...props} />;
}
