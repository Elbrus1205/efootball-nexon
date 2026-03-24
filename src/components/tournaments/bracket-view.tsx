"use client";

import { SingleEliminationBracket, SVGViewer } from "@g-loot/react-tournament-brackets";
import { Match, User } from "@prisma/client";
import { GitBranch, Trophy } from "lucide-react";

export function BracketView({
  matches,
}: {
  matches: (Match & { player1: User | null; player2: User | null; winner: User | null })[];
}) {
  const data = matches.map((match) => ({
    id: match.id,
    name: `R${match.round} #${match.matchNumber}`,
    nextMatchId: match.nextMatchId,
    nextLooserMatchId: match.loserNextMatchId,
    tournamentRoundText: `${match.bracket === "lower" ? "Lower" : "Upper"} / ${match.round}`,
    state: match.status === "CONFIRMED" || match.status === "FINISHED" ? "DONE" : "SCHEDULED",
    participants: [
      {
        id: match.player1Id ?? "tbd-1",
        resultText: match.player1Score?.toString() ?? "-",
        isWinner: match.winnerId === match.player1Id,
        name: match.player1?.nickname ?? match.player1?.name ?? "TBD",
        status: match.player1Id ? "PLAYED" : "NO_SHOW",
      },
      {
        id: match.player2Id ?? "tbd-2",
        resultText: match.player2Score?.toString() ?? "-",
        isWinner: match.winnerId === match.player2Id,
        name: match.player2?.nickname ?? match.player2?.name ?? "TBD",
        status: match.player2Id ? "PLAYED" : "NO_SHOW",
      },
    ],
  }));

  return (
    <div className="overflow-hidden rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-primary">
            <GitBranch className="h-4 w-4" />
            Плей-офф
          </div>
          <div className="text-sm text-zinc-400">Спортивная сетка сезона с переходами между раундами и акцентом на победителя.</div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          <Trophy className="h-4 w-4" />
          Финальная часть
        </div>
      </div>

      <div className="overflow-x-auto bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,rgba(10,10,10,0.65),rgba(10,10,10,0.88))] px-2 py-4 sm:px-4">
        <div className="min-w-[980px] rounded-[1.75rem] border border-white/10 bg-black/25 p-3 shadow-[0_0_45px_rgba(59,130,246,0.08)] backdrop-blur-md">
          <SVGViewer width={1120} height={620}>
            <SingleEliminationBracket matches={data as never} />
          </SVGViewer>
        </div>
      </div>
    </div>
  );
}
