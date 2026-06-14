"use client";

import dynamic from "next/dynamic";
import type { ExportGroup, ExportScheduleRound } from "@/components/admin/tournament-image-exporter";

type TournamentImageExporterLazyProps = {
  tournamentTitle: string;
  groups: ExportGroup[];
  rounds: ExportScheduleRound[];
};

const LazyTournamentImageExporter = dynamic(
  () => import("@/components/admin/tournament-image-exporter").then((mod) => mod.TournamentImageExporter),
  {
    ssr: false,
  },
);

export function TournamentImageExporterLazy(props: TournamentImageExporterLazyProps) {
  return <LazyTournamentImageExporter {...props} />;
}

export type { ExportGroup, ExportScheduleRound };
