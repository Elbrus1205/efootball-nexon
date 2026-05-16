"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminMatch = {
  id: string;
  status: string;
  playerOneScore: number | null;
  playerTwoScore: number | null;
  deadlineAt: Date | string;
  playerOne: { name: string | null; email: string | null };
  playerTwo: { name: string | null; email: string | null };
};

type AdminPlayer = {
  userId: string;
  division: number;
  points: number;
  rating: number | null;
  wins: number;
  losses: number;
  user: { name: string | null; email: string | null };
};

type DivisionSettings = {
  betaEnabled: boolean;
  phaseStartsAt: Date | string | null;
  phaseEndsAt: Date | string | null;
  rulesText: string | null;
};

function name(user: { name: string | null; email: string | null }) {
  return user.name || user.email || "Игрок";
}

function statusLabel(status: string) {
  if (status === "WAITING_GAME") return "Ожидает игру";
  if (status === "WAITING_CONFIRMATION") return "Ожидает подтверждение";
  if (status === "DISPUTED") return "Спорный матч";
  if (status === "FINISHED") return "Завершен";
  if (status === "CANCELLED") return "Отменен";
  return status;
}

function toDateTimeLocal(value: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function DivisionAdminPanel({
  settings,
  matches,
  players,
  currentStatus,
}: {
  settings: DivisionSettings;
  matches: AdminMatch[];
  players: AdminPlayer[];
  currentStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function patchMatch(matchId: string, body: unknown) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/divisions/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Действие не выполнено.");
        return;
      }
      toast.success("Матч обновлен.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            startTransition(async () => {
              await fetch("/api/admin/divisions/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  betaEnabled: form.get("betaEnabled") === "on",
                  phaseStartsAt: form.get("phaseStartsAt"),
                  phaseEndsAt: form.get("phaseEndsAt"),
                  rulesText: form.get("rulesText"),
                }),
              });
              toast.success("Настройки дивизиона сохранены.");
              router.refresh();
            });
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold text-white">Настройки режима</div>
              <div className="text-sm text-zinc-400">Beta, даты фазы и правила, которые видят игроки.</div>
            </div>
            <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white">
              <input name="betaEnabled" type="checkbox" defaultChecked={settings.betaEnabled} />
              Beta включена
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-400">
              Начало фазы
              <Input name="phaseStartsAt" type="datetime-local" defaultValue={toDateTimeLocal(settings.phaseStartsAt)} className="bg-black/30" />
            </label>
            <label className="space-y-2 text-sm text-zinc-400">
              Конец фазы
              <Input name="phaseEndsAt" type="datetime-local" defaultValue={toDateTimeLocal(settings.phaseEndsAt)} className="bg-black/30" />
            </label>
          </div>

          <label className="block space-y-2 text-sm text-zinc-400">
            Правила
            <textarea
              name="rulesText"
              defaultValue={settings.rulesText ?? ""}
              className="min-h-32 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-primary"
              placeholder="Введите правила режима Дивизион"
            />
          </label>

          <Button disabled={pending} type="submit">Сохранить настройки</Button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-white">Матчи дивизиона</h2>
          <select
            value={currentStatus}
            onChange={(event) => router.push(`/admin/divisions?status=${event.target.value}`)}
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white"
          >
            <option value="all">Все статусы</option>
            <option value="WAITING_GAME">Ожидает игру</option>
            <option value="WAITING_CONFIRMATION">Ожидает подтверждение</option>
            <option value="DISPUTED">Спорные матчи</option>
            <option value="FINISHED">Завершенные</option>
            <option value="CANCELLED">Отмененные</option>
          </select>
        </div>

        <div className="grid gap-3">
          {matches.map((match) => (
            <form
              key={match.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                patchMatch(match.id, {
                  action: "confirm",
                  playerOneScore: Number(form.get("playerOneScore")),
                  playerTwoScore: Number(form.get("playerTwoScore")),
                  adminNote: form.get("adminNote"),
                });
              }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="font-bold text-white">{name(match.playerOne)} vs {name(match.playerTwo)}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {statusLabel(match.status)} · дедлайн{" "}
                    {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(match.deadlineAt))}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-[80px_80px_1fr_auto_auto]">
                  <Input name="playerOneScore" type="number" min={0} max={99} defaultValue={match.playerOneScore ?? 0} className="h-10 bg-black/30" />
                  <Input name="playerTwoScore" type="number" min={0} max={99} defaultValue={match.playerTwoScore ?? 0} className="h-10 bg-black/30" />
                  <Input name="adminNote" placeholder="Комментарий" className="h-10 bg-black/30" />
                  <Button disabled={pending} type="submit">Подтвердить</Button>
                  <Button disabled={pending} type="button" variant="outline" onClick={() => patchMatch(match.id, { action: "cancel", adminNote: "Отменено администратором" })}>Отменить</Button>
                </div>
              </div>
            </form>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">Игроки</h2>
        <div className="grid gap-3">
          {players.map((player) => (
            <form
              key={player.userId}
              className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 lg:grid-cols-[1fr_90px_110px_110px_auto] lg:items-center"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                startTransition(async () => {
                  const res = await fetch(`/api/admin/divisions/players/${player.userId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      division: Number(form.get("division")),
                      points: Number(form.get("points")),
                      rating: form.get("rating"),
                    }),
                  });
                  const payload = await res.json().catch(() => null);
                  if (!res.ok) {
                    toast.error(payload?.error || "Игрок не обновлен.");
                    return;
                  }
                  toast.success("Игрок обновлен.");
                  router.refresh();
                });
              }}
            >
              <div>
                <div className="font-bold text-white">{name(player.user)}</div>
                <div className="text-xs text-zinc-500">{player.wins} побед · {player.losses} поражений</div>
              </div>
              <Input name="division" type="number" min={1} max={5} defaultValue={player.division} className="h-10 bg-black/30" />
              <Input name="points" type="number" min={0} defaultValue={player.points} className="h-10 bg-black/30" />
              <Input name="rating" type="number" min={0} defaultValue={player.rating ?? ""} placeholder="rating" className="h-10 bg-black/30" />
              <Button disabled={pending} type="submit">Сохранить</Button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
