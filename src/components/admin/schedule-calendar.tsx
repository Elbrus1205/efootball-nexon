"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

type ScheduleDay = {
  key: string;
  label: string;
  items: ScheduleItem[];
};

function toInputDate(value: string) {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildSlotDate(dayKey: string, slotIndex: number) {
  const date = new Date(`${dayKey}T18:00:00`);
  date.setHours(18 + slotIndex, 0, 0, 0);
  return date.toISOString();
}

export function ScheduleCalendar({ days }: { days: ScheduleDay[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draggedScheduleId, setDraggedScheduleId] = useState<string | null>(null);

  const scheduleMap = useMemo(
    () => new Map(days.flatMap((day) => day.items.map((item) => [item.id, item]))),
    [days],
  );

  const updateSchedule = (matchId: string, startsAt: string, slotLabel: string, endsAt?: string | null) => {
    startTransition(async () => {
      await fetch("/api/admin/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, startsAt, slotLabel, endsAt }),
      });
      router.refresh();
    });
  };

  const moveSchedule = (dayKey: string, slotIndex: number) => {
    if (!draggedScheduleId) return;
    const schedule = scheduleMap.get(draggedScheduleId);
    if (!schedule) return;

    updateSchedule(
      schedule.match.id,
      buildSlotDate(dayKey, slotIndex),
      schedule.slotLabel ?? `Slot ${slotIndex + 1}`,
      schedule.endsAt,
    );
    setDraggedScheduleId(null);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {days.map((day) => (
        <div
          key={day.key}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            moveSchedule(day.key, day.items.length);
          }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">{day.label}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{day.items.length} slots</div>
          </div>

          <div className="space-y-3">
            {day.items.map((schedule, index) => (
              <div
                key={schedule.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  moveSchedule(day.key, index);
                }}
                className={cn("rounded-2xl border border-white/10 bg-black/20 p-4 transition", draggedScheduleId === schedule.id && "border-primary/40 bg-primary/10")}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{schedule.match.tournament.title}</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {(schedule.match.player1?.nickname ?? schedule.match.player1?.name ?? "TBD")} vs{" "}
                      {(schedule.match.player2?.nickname ?? schedule.match.player2?.name ?? "TBD")}
                    </div>
                  </div>
                  <button
                    draggable
                    onDragStart={() => setDraggedScheduleId(schedule.id)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-400"
                  >
                    Drag
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    type="datetime-local"
                    defaultValue={toInputDate(schedule.startsAt)}
                    disabled={pending}
                    onBlur={(event) => updateSchedule(schedule.match.id, event.target.value, schedule.slotLabel ?? "", schedule.endsAt)}
                  />
                  <Input
                    type="text"
                    placeholder="Слот"
                    defaultValue={schedule.slotLabel ?? ""}
                    disabled={pending}
                    onBlur={(event) => updateSchedule(schedule.match.id, toInputDate(schedule.startsAt), event.target.value, schedule.endsAt)}
                    className="sm:w-32"
                  />
                </div>
              </div>
            ))}

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                moveSchedule(day.key, day.items.length);
              }}
              className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-center text-sm text-zinc-500"
            >
              Перетащить матч в конец дня
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
