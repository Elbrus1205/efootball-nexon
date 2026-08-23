"use client";

import { CalendarClock, CheckCircle2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MOSCOW_TIME_ZONE = "Europe/Moscow";

type DeadlineRound = {
  round: number;
  deadlineAt: string | null;
  matchesCount: number;
};

type DeadlineStage = {
  id: string;
  name: string;
  type: "LEAGUE" | "GROUP_STAGE" | "PLAYOFF" | "SUPER_CUP";
  rounds: DeadlineRound[];
};

type RoundDeadlineManagerProps = {
  tournamentId: string;
  stages: DeadlineStage[];
};

function rowKey(stageId: string, round: number) {
  return `${stageId}:${round}`;
}

function getMoscowParts(date: Date) {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function toInputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = getMoscowParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function toApiDate(value: string) {
  return value.trim();
}

function roundUnit(type: DeadlineStage["type"]) {
  return type === "PLAYOFF" || type === "SUPER_CUP" ? "Раунд" : "Тур";
}

function formatShortDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00+03:00`);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
              deadlineAt: toApiDate(nextValues[row.key] ?? ""),
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
    <Card className="overflow-hidden rounded-lg">
      <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <CalendarClock className="h-5 w-5 text-primary" />
          Дедлайны туров
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-2 sm:space-y-4 sm:p-5 sm:pt-2">
        {totalRows ? (
          <>
            <div className="flex justify-end rounded-lg border border-primary/15 bg-primary/[0.06] p-2 sm:p-3">
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:justify-end">
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void saveAllDeadlines()}
                  className="h-9 min-w-0 rounded-lg px-2 text-xs sm:px-3 sm:text-sm"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4 shrink-0" />
                  {isSaving ? "Сохраняю" : "Сохранить"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={clearAllDeadlines}
                  className="h-9 min-w-0 rounded-lg px-2 text-xs sm:px-3 sm:text-sm"
                >
                  <Trash2 className="mr-1.5 h-4 w-4 shrink-0" />
                  Очистить
                </Button>
              </div>
            </div>

            {stages.map((stage) => (
              <div key={stage.id} className="rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4">
                <div className="mb-3 flex min-w-0 items-center justify-between gap-2 sm:mb-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{stage.name}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-zinc-500 sm:text-xs">
                      {roundUnit(stage.type) === "Тур" ? "Туры" : "Раунды"}: {stage.rounds.length}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {stage.rounds.map((round) => {
                    const key = rowKey(stage.id, round.round);
                    const value = values[key] ?? "";
                    const readableDate = value ? formatShortDate(value) : null;

                    return (
                      <div
                        key={key}
                        className={cn(
                          "grid min-w-0 gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-2.5 transition sm:p-3 md:grid-cols-[minmax(110px,0.75fr)_minmax(220px,1fr)] md:items-start",
                          value && "border-primary/25 bg-primary/[0.06]",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white sm:text-base">
                            {roundUnit(stage.type)} {round.round}
                          </div>
                          <div className="mt-0.5 text-xs text-zinc-500">
                            {round.matchesCount ? `${round.matchesCount} матчей` : "Матчи еще не созданы"}
                          </div>
                        </div>

                        <div className="min-w-0 overflow-hidden">
                          <div className="w-full max-w-full overflow-hidden rounded-lg">
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
                              className="block h-10 w-full max-w-full min-w-0 rounded-lg px-1.5 py-0 text-center text-[13px] leading-10 sm:px-2 sm:text-sm [&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:min-h-10 [&::-webkit-date-and-time-value]:text-center [&::-webkit-date-and-time-value]:leading-10"
                            />
                          </div>
                          <div className="mt-1.5 min-h-4 truncate text-xs text-zinc-500">
                            {readableDate ? `Дедлайн: ${readableDate} МСК` : "Дедлайн не задан"}
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
          <div className="rounded-lg border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">
            Сначала создайте этапы и матчи турнира. После этого здесь появятся туры и раунды для дедлайнов.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
