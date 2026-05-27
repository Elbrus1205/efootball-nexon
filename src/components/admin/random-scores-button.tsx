"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Dices } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type RandomScoresButtonProps = {
  tournamentId: string;
  disabled?: boolean;
};

export function RandomScoresButton({ tournamentId, disabled = false }: RandomScoresButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/tournaments/${tournamentId}/matches/random-scores`, {
          method: "POST",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(payload?.error ?? "Не удалось выставить рандомный счет.");
          return;
        }

        toast.success(payload?.message ?? "Рандомный счет выставлен.");
        router.refresh();
      } catch {
        toast.error("Не удалось выставить рандомный счет.");
      }
    });
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
