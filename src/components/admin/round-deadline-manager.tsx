"use client";

import { CalendarClock, CheckCircle2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
  const [isSaving, setIsSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      stages.flatMap((stage) =>
        stage.rounds.map((round) => [rowKey(stage.id, round.round), toInputDate(round.deadlineAt)]),
      ),
    ),
  );

  const totalRows = useMemo(() => stages.reduce((sum, stage) => sum + stage.rounds.length, 0), [stages]);
  const deadlineRows = useMemo(
    () =>
      stages.flatMap((stage) =>
        stage.rounds.map((round) => ({
          stageId: stage.id,
          round: round.round,
          key: rowKey(stage.id, round.round),
        })),
      ),
    [stages],
  );

  const saveAllDeadlines = async (nextValues = values, successMessage = "Дедлайны сохранены.") => {
    if (!deadlineRows.length) return;
    setIsSaving(true);

    try {
      const results = await Promise.all(
        deadlineRows.map(async (row) => {
          const response = await fetch(`/api/admin/tournaments/${tournamentId}/deadlines`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stageId: row.stageId,
              round: row.round,
              deadlineAt: nextValues[row.key] ?? "",
            }),
          });
          const payload = await response.json().catch(() => ({
            error: "Не удалось обработать ответ сервера.",
          }));

          return { response, payload };
        }),
      );
      const failed = results.find((result) => !result.response.ok);

      if (failed) {
        toast.error(failed.payload?.error ?? "Не удалось сохранить дедлайны.");
        return;
      }

      toast.success(successMessage);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const clearAllDeadlines = () => {
    const emptyValues = Object.fromEntries(deadlineRows.map((row) => [row.key, ""]));
    setValues((current) => ({ ...current, ...emptyValues }));
    void saveAllDeadlines(emptyValues, "Все дедлайны очищены.");
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
          <>
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-300">
                Заполните нужные даты, оставьте лишние поля пустыми и сохраните все дедлайны одним нажатием.
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveAllDeadlines()}
                  className="h-11 min-h-11 rounded-xl px-4"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {isSaving ? "Сохранение" : "Сохранить все"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={clearAllDeadlines}
                  className="h-11 min-h-11 rounded-xl px-4"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Очистить все
                </Button>
              </div>
            </div>

            {stages.map((stage) => (
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

                    return (
                      <div
                        key={key}
                        className={cn(
                          "grid gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 transition md:grid-cols-[minmax(120px,0.8fr)_minmax(220px,1fr)] md:items-start",
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
                            disabled={isSaving}
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
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">
            Сначала создайте этапы и матчи турнира. После этого здесь появятся туры и раунды для дедлайнов.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
