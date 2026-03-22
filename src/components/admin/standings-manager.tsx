"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type StandingItem = {
  id: string;
  rank: number | null;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  participant: {
    user: {
      nickname: string | null;
      name: string | null;
    };
  };
};

type GroupItem = {
  id: string;
  name: string;
  standings: StandingItem[];
};

export function StandingsManager({ groups }: { groups: GroupItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const updateStanding = (standingId: string, payload: Record<string, unknown>) => {
    startTransition(async () => {
      await fetch(`/api/admin/standings/${standingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {groups.map((group) => (
        <div key={group.id} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 font-medium text-white">{group.name}</div>
          <div className="space-y-3">
            {group.standings.map((standing) => (
              <div key={standing.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 font-medium text-white">{standing.participant.user.nickname ?? standing.participant.user.name}</div>
                <div className="grid gap-2 sm:grid-cols-4">
                  {[
                    ["rank", standing.rank ?? 0, "Место"],
                    ["points", standing.points, "Очки"],
                    ["goalDifference", standing.goalDifference, "РМ"],
                    ["played", standing.played, "Игры"],
                  ].map(([field, value, label]) => (
                    <label key={String(field)} className="text-xs text-zinc-500">
                      <span className="mb-1 block uppercase tracking-[0.18em]">{label}</span>
                      <input
                        type="number"
                        defaultValue={Number(value)}
                        disabled={pending}
                        onBlur={(event) => updateStanding(standing.id, { [field]: Number(event.target.value) })}
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
