"use client";

import { ClubSelectionMode } from "@prisma/client";
import { CheckCircle2, ScrollText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ClubOption = {
  slug: string;
  name: string;
  imagePath: string;
};

type RegulationsState = {
  body: string;
  version: string;
  updatedAt: string | null;
};

type AfterRegulationsAction = "register" | "choose-club";

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
  const [regulations, setRegulations] = useState<RegulationsState | null>(null);
  const [regulationsOpen, setRegulationsOpen] = useState(false);
  const [regulationsAccepted, setRegulationsAccepted] = useState(false);
  const [pendingClubSlug, setPendingClubSlug] = useState<string | undefined>();
  const [afterRegulationsAction, setAfterRegulationsAction] = useState<AfterRegulationsAction>("register");
  const [regulationsError, setRegulationsError] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableClubs = useMemo(
    () => clubs.filter((club) => !takenClubSlugs.includes(club.slug)),
    [clubs, takenClubSlugs],
  );

  const loadRegulations = async () => {
    const response = await fetch("/api/regulations/acceptance", { cache: "no-store" });
    const result = await response.json().catch(() => ({ error: "Не удалось загрузить регламент." }));

    if (!response.ok) {
      throw new Error(result.error ?? "Не удалось загрузить регламент.");
    }

    if (result.regulations) {
      setRegulations(result.regulations);
    }

    return Boolean(result.accepted);
  };

  const openRegulationsAcceptance = async (clubSlug?: string, nextAction: AfterRegulationsAction = "register") => {
    setPendingClubSlug(clubSlug);
    setAfterRegulationsAction(nextAction);
    setRegulationsAccepted(false);
    setRegulationsError("");

    if (!regulations) {
      await loadRegulations();
    }

    setRegulationsOpen(true);
  };

  const submitRegistration = async (clubSlug?: string) => {
    setMessage("Регистрация...");

    const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clubSlug ? { clubSlug } : {}),
    });

    const result = await response.json().catch(() => ({ error: "Не удалось обработать ответ сервера." }));
    if (!response.ok) {
      if (response.status === 428 && result.code === "REGULATIONS_ACCEPTANCE_REQUIRED") {
        setMessage("");
        setIsOpen(false);
        await openRegulationsAcceptance(clubSlug, clubSlug ? "register" : clubSelectionMode === ClubSelectionMode.PLAYER_PICK ? "choose-club" : "register");
        return;
      }

      if (response.status === 409 && clubSlug) {
        setSelectedClubSlug("");
        router.refresh();
      }
      setMessage(result.error ?? "Не удалось зарегистрироваться.");
      return;
    }

    setIsOpen(false);
    setRegulationsOpen(false);
    setPendingClubSlug(undefined);
    setMessage("");
    router.refresh();
  };

  const submit = (clubSlug?: string) => {
    startTransition(async () => {
      setMessage("Проверяем регламент...");

      try {
        const accepted = await loadRegulations();
        if (!accepted) {
          setMessage("");
          await openRegulationsAcceptance(clubSlug, "register");
          return;
        }

        await submitRegistration(clubSlug);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Не удалось проверить регламент.");
      }
    });
  };

  const openClubSelection = () => {
    startTransition(async () => {
      setMessage("Проверяем регламент...");

      try {
        const accepted = await loadRegulations();
        setMessage("");

        if (!accepted) {
          await openRegulationsAcceptance(undefined, "choose-club");
          return;
        }

        setIsOpen(true);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Не удалось проверить регламент.");
      }
    });
  };

  const submitSelectedClub = () => {
    startTransition(async () => {
      await submitRegistration(selectedClubSlug);
    });
  };

  const acceptRegulationsAndContinue = () => {
    startTransition(async () => {
      setRegulationsError("");

      const response = await fetch("/api/regulations/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const result = await response.json().catch(() => ({ error: "Не удалось принять регламент." }));

      if (!response.ok) {
        setRegulationsError(result.error ?? "Не удалось принять регламент.");
        return;
      }

      setRegulationsOpen(false);

      if (afterRegulationsAction === "choose-club") {
        setMessage("");
        setIsOpen(true);
        return;
      }

      await submitRegistration(pendingClubSlug);
    });
  };

  const regulationsModal = regulationsOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-3xl overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold text-white">
              <ScrollText className="h-5 w-5 text-primary" />
              Принятие регламента
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Перед регистрацией на турнир нужно прочитать и принять актуальную версию регламента.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setRegulationsOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4 p-5">
          <div className="max-h-[48vh] overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-zinc-200">
            <div className="whitespace-pre-wrap">{regulations?.body ?? "Загрузка регламента..."}</div>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <input
              type="checkbox"
              checked={regulationsAccepted}
              onChange={(event) => setRegulationsAccepted(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40"
            />
            <span>Я прочитал актуальный регламент и принимаю его условия.</span>
          </label>

          {regulationsError ? <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{regulationsError}</div> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setRegulationsOpen(false)}>
              Отмена
            </Button>
            <Button onClick={acceptRegulationsAndContinue} disabled={isPending || !regulationsAccepted} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {isPending ? "Сохраняем..." : afterRegulationsAction === "choose-club" ? "Принять и выбрать клуб" : "Принять и зарегистрироваться"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  ) : null;

  if (clubSelectionMode === ClubSelectionMode.ADMIN_RANDOM) {
    return (
      <div className="space-y-2">
        <Button size="lg" onClick={() => submit()} disabled={isPending}>
          {isPending ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
        {message ? <div className="text-sm text-red-300">{message}</div> : null}
        {regulationsModal}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Button size="lg" onClick={openClubSelection} disabled={isPending}>
          {isPending ? "Проверяем..." : "Зарегистрироваться"}
        </Button>
        {message ? <div className="text-sm text-red-300">{message}</div> : null}
        {regulationsModal}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Выберите клуб</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Один клуб может быть только у одного участника. Уже занятые клубы недоступны для выбора.
                </p>
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
                <Button onClick={submitSelectedClub} disabled={isPending || !selectedClubSlug}>
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
