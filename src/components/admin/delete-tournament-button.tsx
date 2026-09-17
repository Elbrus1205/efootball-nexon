"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeleteTournamentButtonProps = {
  tournamentId: string;
  tournamentTitle: string;
  showPreserveHomeStats?: boolean;
};

export function DeleteTournamentButton({ tournamentId, tournamentTitle, showPreserveHomeStats = false }: DeleteTournamentButtonProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [preserveHomeStats, setPreserveHomeStats] = useState(false);

  return (
    <div className={showPreserveHomeStats ? "grid gap-2 rounded-md border border-red-400/15 bg-red-500/[0.045] p-2.5 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center" : "contents"}>
      {showPreserveHomeStats ? (
        <label className="flex min-w-0 items-start gap-2 px-1 text-[11px] leading-4 text-zinc-400 sm:text-xs">
          <input type="checkbox" checked={preserveHomeStats} onChange={(event) => setPreserveHomeStats(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-white/15 bg-black/40 accent-primary" />
          <span>Сохранить турнир и призовой фонд в статистике главной</span>
        </label>
      ) : null}
      <Dialog.Root open={open} onOpenChange={(next) => !isDeleting && setOpen(next)}>
        <Dialog.Trigger asChild>
          <Button type="button" variant="outline" className="min-h-11 w-full gap-2 whitespace-normal rounded-lg border-red-400/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-200 hover:bg-red-500/20">
            <Trash2 className="h-4 w-4 shrink-0" />
            {showPreserveHomeStats ? "Удалить турнир" : "Удалить"}
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-white/10 bg-[#1d1d1d] p-5 shadow-xl focus:outline-none sm:p-6">
            <Dialog.Title className="text-lg font-semibold text-white">Удалить турнир?</Dialog.Title>
            <Dialog.Description className="mt-3 text-sm leading-6 text-zinc-300">
              Турнир «{tournamentTitle}», его участники, матчи и результаты будут удалены. Это действие необратимо.
            </Dialog.Description>
            {preserveHomeStats ? <p className="mt-3 text-xs leading-5 text-zinc-400">Количество турниров и призовой фонд сохранятся в статистике главной. Участники и история матчей не сохраняются этой галочкой.</p> : null}
            <form action={`/api/admin/tournaments/${tournamentId}`} method="post" onSubmit={() => setIsDeleting(true)} className="mt-5 grid grid-cols-2 gap-2">
              <input type="hidden" name="_method" value="delete" />
              <input type="hidden" name="confirmationTitle" value={tournamentTitle} />
              {preserveHomeStats ? <input type="hidden" name="preserveHomeStats" value="on" /> : null}
              <Dialog.Close asChild><Button type="button" variant="outline" disabled={isDeleting} className="min-h-11">Отмена</Button></Dialog.Close>
              <Button type="submit" disabled={isDeleting} variant="outline" className="min-h-11 gap-2 border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20">
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {isDeleting ? "Удаление…" : "Удалить"}
              </Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
