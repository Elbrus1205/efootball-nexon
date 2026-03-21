"use client";

import { SingleEliminationBracket, SVGViewer } from "@g-loot/react-tournament-brackets";
import { Match, User } from "@prisma/client";

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
    state: match.status === "CONFIRMED" ? "DONE" : "SCHEDULED",
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
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-black/30 p-4">
      <SVGViewer width={1000} height={520}>
        <SingleEliminationBracket matches={data as never} />
      </SVGViewer>
    </div>
  );
}
