"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TransferUserAccountForm({
  userId,
  returnTo,
  disabled = false,
}: {
  userId: string;
  returnTo: string;
  disabled?: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form action={`/api/admin/users/${userId}/transfer`} method="post" className="min-w-0 space-y-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="confirmTransfer" value={confirmed ? "true" : "false"} />
      <div>
        <div className="text-sm font-medium text-white">Перенос аккаунта</div>
        <div className="mt-1 text-xs text-zinc-500">Перенесет турниры, матчи, статистику, уведомления и покупки на другой аккаунт.</div>
      </div>

      <Input name="targetUserId" placeholder="ID целевого аккаунта" disabled={disabled} required />

      <label className={`flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 ${disabled ? "opacity-50" : ""}`}>
        <span className="min-w-0 text-sm text-zinc-200">Подтвердить перенос</span>
        <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={disabled}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full border border-white/10 bg-white/10 transition peer-checked:border-sky-300/40 peer-checked:bg-sky-500/70" />
          <span className="absolute left-1 h-5 w-5 rounded-full bg-zinc-300 shadow transition peer-checked:translate-x-5 peer-checked:bg-white" />
        </span>
      </label>

      <Button type="submit" variant="outline" disabled={disabled || !confirmed} className="w-full border-sky-400/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/15">
        Перенести
      </Button>
    </form>
  );
}
