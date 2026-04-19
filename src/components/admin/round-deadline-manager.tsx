"use client";

import { CalendarClock, CheckCircle2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DeadlineRound = {
  round: number;
  deadlineAt: string | null;
  matchesCount: number;
};

type DeadlineStage = {
  id: string;
  name: string;
  type: "LEAGUE" | "GROUP_STAGE" | "PLAYOFF";
  rounds: DeadlineRound[];
};

type RoundDeadlineManagerProps = {
  tournamentId: string;
  stages: DeadlineStage[];
};

function rowKey(stageId: string, round: number) {
  return `${stageId}:${round}`;
}

function toInputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function roundUnit(type: DeadlineStage["type"]) {
  return type === "PLAYOFF" ? "Раунд" : "Тур";
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RoundDeadlineManager({ tournamentId, stages }: RoundDeadlineManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      stages.flatMap((stage) =>
        stage.rounds.map((round) => [rowKey(stage.id, round.round), toInputDate(round.deadlineAt)]),
      ),
    ),
  );

  const totalRows = useMemo(() => stages.reduce((sum, stage) => sum + stage.rounds.length, 0), [stages]);

  const saveDeadline = (stageId: string, round: number, deadlineAt: string) => {
    const key = rowKey(stageId, round);
    setSavingKey(key);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/tournaments/${tournamentId}/deadlines`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId, round, deadlineAt }),
        });
        const payload = await response.json().catch(() => ({
          error: "Не удалось обработать ответ сервера.",
        }));

        if (!response.ok) {
          toast.error(payload?.error ?? "Не удалось сохранить дедлайн.");
          return;
        }

        toast.success(deadlineAt ? "Дедлайн сохранён." : "Дедлайн очищен.");
        router.refresh();
      } finally {
        setSavingKey(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Дедлайны туров
        </CardTitle>
        <CardDescription>
          Перед стартом турнира задайте срок для каждого тура группы/лиги и каждого раунда плей-офф. Количество строк берётся из структуры турнира.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {totalRows ? (
          stages.map((stage) => (
            <div key={stage.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-white">{stage.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">
                    {roundUnit(stage.type) === "Тур" ? "Туры" : "Раунды"}: {stage.rounds.length}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {stage.rounds.map((round) => {
                  const key = rowKey(stage.id, round.round);
                  const value = values[key] ?? "";
                  const readableDate = value ? formatShortDate(value) : null;
                  const isSaving = pending && savingKey === key;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "grid gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition md:grid-cols-[minmax(120px,0.8fr)_minmax(220px,1fr)_auto] md:items-center",
                        value && "border-primary/25 bg-primary/[0.06]",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-white">
                          {roundUnit(stage.type)} {round.round}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {round.matchesCount ? `${round.matchesCount} матчей` : "Матчи ещё не созданы"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <Input
                          type="datetime-local"
                          value={value}
                          disabled={pending}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          className="w-full min-w-0"
                        />
                        <div className="mt-2 min-h-4 text-xs text-zinc-500">
                          {readableDate ? `Дедлайн: ${readableDate}` : "Дедлайн не задан"}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 md:flex md:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() => saveDeadline(stage.id, round.round, value)}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          {isSaving ? "Сохранение" : "Сохранить"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending || !value}
                          onClick={() => {
                            setValues((current) => ({ ...current, [key]: "" }));
                            saveDeadline(stage.id, round.round, "");
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Очистить
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">
            Сначала создайте этапы и матчи турнира. После этого здесь появятся туры и раунды для дедлайнов.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
