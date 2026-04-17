"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteUserAccountForm({
  userId,
  disabled = false,
}: {
  userId: string;
  disabled?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form action={`/api/admin/users/${userId}/delete`} method="post" className="min-w-0 space-y-3 rounded-2xl border border-red-400/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.1),rgba(0,0,0,0.2))] p-4">
      <input type="hidden" name="confirmDelete" value={confirmed ? "true" : "false"} />
      <div>
        <div className="text-sm font-medium text-white">Удаление аккаунта</div>
        <div className="mt-1 text-xs text-zinc-500">
          Аккаунт и связанные с ним данные будут удалены без восстановления.
        </div>
      </div>

      <label className={`flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 ${disabled ? "opacity-50" : ""}`}>
        <span className="min-w-0 text-sm text-zinc-200">Подтвердить удаление</span>
        <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={disabled}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full border border-white/10 bg-white/10 transition peer-checked:border-red-300/40 peer-checked:bg-red-500/70" />
          <span className="absolute left-1 h-5 w-5 rounded-full bg-zinc-300 shadow transition peer-checked:translate-x-5 peer-checked:bg-white" />
        </span>
      </label>

      <Button
        type="submit"
        disabled={disabled || !confirmed}
        className="w-full bg-red-500 text-white hover:bg-red-500/90 disabled:bg-white/10 disabled:text-zinc-500"
      >
        {disabled ? "Нельзя удалить себя" : "Удалить аккаунт"}
      </Button>
    </form>
  );
}
