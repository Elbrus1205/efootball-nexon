"use client";

import { GripVertical, MoveLeft, MoveRight } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "Ожидает",
  ACTIVE: "Активен",
  COMPLETED: "Завершён",
};

const stageTypeLabels: Record<string, string> = {
  LEAGUE: "Лига",
  GROUP_STAGE: "Группы",
  PLAYOFF: "Плей-офф",
};

export function StageEditor({ tournamentId, stages }: { tournamentId: string; stages: StageItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [orderedStages, setOrderedStages] = useState(stages);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);

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

  const saveOrder = (nextStageIds: string[]) => {
    startTransition(async () => {
      await fetch(`/api/admin/tournaments/${tournamentId}/stages/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          stageIds: nextStageIds,
        }),
      });
      router.refresh();
    });
  };

  const reorderStages = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const items = [...orderedStages];
    const fromIndex = items.findIndex((stage) => stage.id === fromId);
    const toIndex = items.findIndex((stage) => stage.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);
    setOrderedStages(items);
    saveOrder(items.map((stage) => stage.id));
  };

  const shiftStage = (stageId: string, direction: -1 | 1) => {
    const index = orderedStages.findIndex((stage) => stage.id === stageId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= orderedStages.length) return;
    const items = [...orderedStages];
    [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
    setOrderedStages(items);
    saveOrder(items.map((stage) => stage.id));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Pipeline</div>
            <div className="mt-2 text-sm text-zinc-400">Этапы можно перетаскивать, чтобы менять порядок турнира и визуальную цепочку прохождения сезона.</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-3 pb-2">
            {orderedStages.map((stage, index) => (
              <div key={stage.id} className="flex items-center gap-3">
                <button
                  draggable
                  onDragStart={() => setDraggedStageId(stage.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!draggedStageId) return;
                    reorderStages(draggedStageId, stage.id);
                    setDraggedStageId(null);
                  }}
                  className={cn(
                    "group w-72 rounded-[1.75rem] border border-white/10 bg-black/20 p-5 text-left transition",
                    draggedStageId === stage.id && "border-primary/40 bg-primary/10",
                  )}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-400">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Этап {index + 1}</div>
                        <div className="mt-1 text-lg font-semibold text-white">{stage.name}</div>
                      </div>
                    </div>
                    <Badge variant={stage.status === "ACTIVE" ? "accent" : stage.status === "COMPLETED" ? "success" : "neutral"}>
                      {statusLabels[stage.status] ?? stage.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                    <Badge variant="primary">{stageTypeLabels[stage.type] ?? stage.type}</Badge>
                    {stage.groupsCount ? <span>{stage.groupsCount} групп</span> : null}
                    {stage.participantsPerGroup ? <span>{stage.participantsPerGroup} в группе</span> : null}
                    {stage.advancingPerGroup ? <span>выходят {stage.advancingPerGroup}</span> : null}
                    {stage.roundsCount ? <span>{stage.roundsCount} раундов</span> : null}
                  </div>
                </button>

                {index < orderedStages.length - 1 ? <div className="h-px w-14 bg-gradient-to-r from-primary/50 to-transparent" /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {orderedStages.map((stage) => (
          <div key={stage.id} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
              <div className="space-y-3">
                <Input defaultValue={stage.name} disabled={pending} onBlur={(event) => updateStage(stage.id, { name: event.target.value })} />
                <div className="flex flex-wrap gap-3 text-sm text-zinc-500">
                  <span>{stageTypeLabels[stage.type] ?? stage.type}</span>
                  <span>Порядок: {orderedStages.findIndex((item) => item.id === stage.id) + 1}</span>
                  {stage.groupsCount ? <span>Групп: {stage.groupsCount}</span> : null}
                  {stage.participantsPerGroup ? <span>Игроков в группе: {stage.participantsPerGroup}</span> : null}
                  {stage.advancingPerGroup ? <span>Выходят: {stage.advancingPerGroup}</span> : null}
                  {stage.roundsCount ? <span>Раундов: {stage.roundsCount}</span> : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" disabled={pending || orderedStages[0]?.id === stage.id} onClick={() => shiftStage(stage.id, -1)}>
                    <MoveLeft className="mr-2 h-4 w-4" />
                    Раньше
                  </Button>
                  <Button variant="outline" disabled={pending || orderedStages[orderedStages.length - 1]?.id === stage.id} onClick={() => shiftStage(stage.id, 1)}>
                    <MoveRight className="mr-2 h-4 w-4" />
                    Позже
                  </Button>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {["DRAFT", "PENDING", "ACTIVE", "COMPLETED"].map((status) => (
                    <Button
                      key={status}
                      variant={stage.status === status ? "default" : "outline"}
                      disabled={pending}
                      onClick={() => updateStage(stage.id, { status })}
                    >
                      {statusLabels[status] ?? status}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
