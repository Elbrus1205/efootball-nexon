"use client";

import { type FormEvent } from "react";
import { Button } from "@/components/ui/button";

const actionLabels: Record<string, string> = {
  rating: "обнулить рейтинг",
  stats: "обнулить статистику",
  statuses: "обнулить статусы",
  full: "полностью обнулить профильные данные",
};

type UserResetActionsProps = {
  userId: string;
  returnTo: string;
  disabled?: boolean;
};

export function UserResetActions({ userId, returnTo, disabled = false }: UserResetActionsProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter;
    const action = submitter instanceof HTMLButtonElement ? submitter.value : "";
    const label = actionLabels[action] ?? "применить сброс";

    if (!window.confirm(`Подтвердите действие: ${label}. История матчей сохранится.`)) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={`/api/admin/users/${userId}/reset`}
      method="post"
      onSubmit={handleSubmit}
      className="min-w-0 space-y-3 rounded-lg border border-rose-300/20 bg-[linear-gradient(180deg,rgba(33,241,168,0.08),rgba(0,0,0,0.2))] p-4"
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <div>
        <div className="text-sm font-semibold text-white">Обнуление игрока</div>
        <div className="mt-1 text-xs text-zinc-500">Рейтинг, статистику и статусы можно сбросить отдельно.</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" name="action" value="rating" variant="outline" className="h-10 rounded-lg px-2 text-[11px]" disabled={disabled}>
          Рейтинг
        </Button>
        <Button type="submit" name="action" value="stats" variant="outline" className="h-10 rounded-lg px-2 text-[11px]" disabled={disabled}>
          Статистика
        </Button>
        <Button type="submit" name="action" value="statuses" variant="outline" className="h-10 rounded-lg px-2 text-[11px]" disabled={disabled}>
          Статусы
        </Button>
        <Button type="submit" name="action" value="full" className="h-10 rounded-lg border-rose-400/40 bg-rose-500/15 px-2 text-[11px] text-rose-50 hover:bg-rose-500/25" disabled={disabled}>
          Полный сброс
        </Button>
      </div>
    </form>
  );
}
