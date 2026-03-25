"use client";

import { ClubSelectionMode } from "@prisma/client";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ClubOption = {
  slug: string;
  name: string;
  imagePath: string;
};

export function RegisterTournamentButton({
  tournamentId,
  clubSelectionMode,
  clubs,
  takenClubSlugs,
}: {
  tournamentId: string;
  clubSelectionMode: ClubSelectionMode;
  clubs: ClubOption[];
  takenClubSlugs: string[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClubSlug, setSelectedClubSlug] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableClubs = useMemo(
    () => clubs.filter((club) => !takenClubSlugs.includes(club.slug)),
    [clubs, takenClubSlugs],
  );

  const submit = (clubSlug?: string) => {
    startTransition(async () => {
      setMessage("Регистрация...");

      const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clubSlug ? { clubSlug } : {}),
      });

      const result = await response.json().catch(() => ({ error: "Не удалось обработать ответ сервера." }));
      if (!response.ok) {
        setMessage(result.error ?? "Не удалось зарегистрироваться.");
        return;
      }

      setIsOpen(false);
      setMessage("");
      router.refresh();
    });
  };

  if (clubSelectionMode === ClubSelectionMode.ADMIN_RANDOM) {
    return (
      <div className="space-y-2">
        <Button size="lg" onClick={() => submit()} disabled={isPending}>
          {isPending ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
        {message ? <div className="text-sm text-red-300">{message}</div> : null}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Button size="lg" onClick={() => setIsOpen(true)}>
          Зарегистрироваться
        </Button>
        {message ? <div className="text-sm text-red-300">{message}</div> : null}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Выберите клуб</h3>
                <p className="mt-2 text-sm text-zinc-400">Один клуб может быть только у одного участника. Занятые клубы недоступны для выбора.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
              {clubs.map((club) => {
                const taken = takenClubSlugs.includes(club.slug);
                const selected = selectedClubSlug === club.slug;
                return (
                  <button
                    key={club.slug}
                    type="button"
                    disabled={taken}
                    onClick={() => setSelectedClubSlug(club.slug)}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                      taken
                        ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
                        : selected
                          ? "border-primary bg-primary/10"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={club.imagePath} alt={club.name} className="h-full w-full object-contain p-1" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white">{club.name}</div>
                      <div className="mt-1 text-sm text-zinc-500">{taken ? "Клуб уже занят" : "Доступен для выбора"}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-400">
                {availableClubs.length ? `Свободно клубов: ${availableClubs.length}` : "Свободных клубов больше нет."}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={() => submit(selectedClubSlug)} disabled={isPending || !selectedClubSlug}>
                  {isPending ? "Регистрация..." : "Подтвердить выбор"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
