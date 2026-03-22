"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

type StageItem = {
  id: string;
  name: string;
  type: string;
  status: string;
  orderIndex: number;
  groupsCount: number | null;
  participantsPerGroup: number | null;
  advancingPerGroup: number | null;
  roundsCount: number | null;
};

export function StageEditor({ stages }: { stages: StageItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const updateStage = (stageId: string, payload: Record<string, unknown>) => {
    startTransition(async () => {
      await fetch(`/api/admin/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      {stages.map((stage) => (
        <div key={stage.id} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
            <div className="space-y-3">
              <input
                defaultValue={stage.name}
                disabled={pending}
                onBlur={(event) => updateStage(stage.id, { name: event.target.value })}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
              />
              <div className="flex flex-wrap gap-3 text-sm text-zinc-500">
                <span>{stage.type}</span>
                <span>Порядок: {stage.orderIndex}</span>
                {stage.groupsCount ? <span>Групп: {stage.groupsCount}</span> : null}
                {stage.participantsPerGroup ? <span>Игроков в группе: {stage.participantsPerGroup}</span> : null}
                {stage.advancingPerGroup ? <span>Выходят: {stage.advancingPerGroup}</span> : null}
                {stage.roundsCount ? <span>Раундов: {stage.roundsCount}</span> : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {["DRAFT", "PENDING", "ACTIVE", "COMPLETED"].map((status) => (
                <Button
                  key={status}
                  variant={stage.status === status ? "default" : "outline"}
                  disabled={pending}
                  onClick={() => updateStage(stage.id, { status })}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
