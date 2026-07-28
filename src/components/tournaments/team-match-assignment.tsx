"use client";

import { useState } from "react";
import { Loader2, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type PlayerOption = { id: string; name: string };

export function TeamMatchAssignment({
  tournamentId,
  matchId,
  homePlayers,
  awayPlayers,
}: {
  tournamentId: string;
  matchId: string;
  homePlayers: PlayerOption[];
  awayPlayers: PlayerOption[];
}) {
  const router = useRouter();
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function assignMatch() {
    if (!player1Id || !player2Id) {
      setError("Выберите обоих игроков.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/team-matches/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player1Id, player2Id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Не удалось назначить матч.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось назначить матч.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
        Ваш игрок
        <select value={player1Id} onChange={(event) => setPlayer1Id(event.target.value)} disabled={pending} className="h-11 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
          <option value="">Выберите игрока</option>
          {homePlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-zinc-400">
        Игрок гостей
        <select value={player2Id} onChange={(event) => setPlayer2Id(event.target.value)} disabled={pending} className="h-11 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white">
          <option value="">Выберите игрока</option>
          {awayPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
      </label>
      <Button type="button" onClick={assignMatch} disabled={pending || !player1Id || !player2Id} className="h-11">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
        <span className="ml-2">Подтвердить пару</span>
      </Button>
      {error ? <p role="alert" className="sm:col-span-3 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
