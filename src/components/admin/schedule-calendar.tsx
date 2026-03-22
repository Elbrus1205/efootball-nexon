"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type ScheduleItem = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  slotLabel: string | null;
  timezone: string | null;
  match: {
    id: string;
    tournament: { title: string };
    player1: { nickname: string | null; name: string | null } | null;
    player2: { nickname: string | null; name: string | null } | null;
  };
};

function toInputDate(value: string) {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleCalendar({ groups }: { groups: Record<string, ScheduleItem[]> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const updateSchedule = (matchId: string, startsAt: string, slotLabel: string) => {
    startTransition(async () => {
      await fetch("/api/admin/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, startsAt, slotLabel }),
      });
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Object.entries(groups).map(([day, items]) => (
        <div key={day} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-primary">{day}</div>
          <div className="space-y-3">
            {items.map((schedule) => (
              <div key={schedule.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-medium text-white">{schedule.match.tournament.title}</div>
                <div className="mt-1 text-sm text-zinc-400">
                  {(schedule.match.player1?.nickname ?? schedule.match.player1?.name ?? "TBD")} vs{" "}
                  {(schedule.match.player2?.nickname ?? schedule.match.player2?.name ?? "TBD")}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="datetime-local"
                    defaultValue={toInputDate(schedule.startsAt)}
                    disabled={pending}
                    onBlur={(event) => updateSchedule(schedule.match.id, event.target.value, schedule.slotLabel ?? "")}
                    className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                  />
                  <input
                    type="text"
                    placeholder="Слот"
                    defaultValue={schedule.slotLabel ?? ""}
                    disabled={pending}
                    onBlur={(event) => updateSchedule(schedule.match.id, toInputDate(schedule.startsAt), event.target.value)}
                    className="h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
