"use client";

import { type FormEvent, useState } from "react";
import { Trash2 } from "lucide-react";

type DeleteTournamentButtonProps = {
  tournamentId: string;
  tournamentTitle: string;
};

export function DeleteTournamentButton({ tournamentId, tournamentTitle }: DeleteTournamentButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Удалить турнир «${tournamentTitle}»?\n\nБудут удалены его участники, этапы, матчи и связанные данные. Это действие необратимо.`,
    );

    if (!confirmed) {
      event.preventDefault();
      return;
    }

    setIsDeleting(true);
  }

  return (
    <form action={`/api/admin/tournaments/${tournamentId}`} method="post" onSubmit={handleSubmit} className="contents">
      <input type="hidden" name="_method" value="delete" />
      <button
        type="submit"
        disabled={isDeleting}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-[13px] font-medium text-red-200 transition hover:bg-red-500/20 hover:text-red-100 disabled:cursor-wait sm:text-sm"
      >
        <Trash2 className="h-4 w-4" />
        {isDeleting ? "Удаление…" : "Удалить"}
      </button>
    </form>
  );
}
