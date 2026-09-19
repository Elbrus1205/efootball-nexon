"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Dices } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type RandomScoresButtonProps = {
  tournamentId: string;
  disabled?: boolean;
};

export function RandomScoresButton({ tournamentId, disabled = false }: RandomScoresButtonProps) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const requestInFlight = useRef(false);
  const pending = saving || refreshing;

  async function handleClick() {
    if (requestInFlight.current || pending) return;
    requestInFlight.current = true;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/matches/random-scores`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload: unknown = await response.json().catch(() => null);
      const result = payload && typeof payload === "object" ? payload : {};

      if (!response.ok) {
        toast.error("error" in result && typeof result.error === "string" ? result.error : "Не удалось выставить рандомный счет. Обновите страницу и проверьте результаты перед повторной попыткой.");
        return;
      }

      if ("warning" in result && typeof result.warning === "string") {
        toast.warning(result.warning);
      } else {
        toast.success("message" in result && typeof result.message === "string" ? result.message : "Рандомный счет выставлен.");
      }
      startTransition(() => router.refresh());
    } catch {
      toast.error("Связь с сервером прервалась. Обновите страницу и проверьте результаты перед повторной попыткой.");
    } finally {
      requestInFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <Button
      type="button"
      disabled={disabled || pending}
      variant="outline"
      onClick={handleClick}
      className="h-10 w-full rounded-lg border-amber-300/30 bg-amber-300/10 px-4 text-amber-100 hover:bg-amber-300/15 sm:w-auto"
    >
      <Dices className="mr-2 h-4 w-4" />
      {pending ? "Выставляю..." : "Выставить рандом"}
    </Button>
  );
}
