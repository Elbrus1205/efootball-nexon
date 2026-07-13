"use client";

import { ClubSelectionMode, TournamentParticipantMode } from "@prisma/client";
import { CheckCircle2, ImagePlus, Loader2, Search, ScrollText, Trash2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadFile } from "@/lib/storage/upload-client";

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

function normalizeClubSearch(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

export function RegisterTournamentButton({
  tournamentId,
  clubSelectionMode,
  participantMode = TournamentParticipantMode.SINGLE,
  rosterSize = 1,
  requireLineupPhoto = false,
  clubs,
  takenClubSlugs,
}: {
  tournamentId: string;
  clubSelectionMode: ClubSelectionMode;
  participantMode?: TournamentParticipantMode;
  rosterSize?: number;
  requireLineupPhoto?: boolean;
  clubs: ClubOption[];
  takenClubSlugs: string[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClubSlug, setSelectedClubSlug] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [teamName, setTeamName] = useState("");
  const [lineupPhotoUrl, setLineupPhotoUrl] = useState("");
  const [lineupOpen, setLineupOpen] = useState(false);
  const [lineupUploading, setLineupUploading] = useState(false);
  const [lineupError, setLineupError] = useState("");
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
  const filteredClubs = useMemo(() => {
    const query = normalizeClubSearch(clubSearch);
    const source = query
      ? clubs.filter((club) => {
          const searchable = [club.name, club.slug, club.imagePath].map(normalizeClubSearch).join(" ");
          return searchable.includes(query);
        })
      : clubs;

    return [...source].sort((a, b) => {
      const aTaken = takenClubSlugs.includes(a.slug);
      const bTaken = takenClubSlugs.includes(b.slug);
      if (aTaken !== bTaken) return Number(aTaken) - Number(bTaken);
      return a.name.localeCompare(b.name, "ru");
    });
  }, [clubSearch, clubs, takenClubSlugs]);

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

  const submitRegistration = async (clubSlug?: string, photoUrl?: string) => {
    if (requireLineupPhoto && !photoUrl) {
      setPendingClubSlug(clubSlug);
      setIsOpen(false);
      setLineupOpen(true);
      setMessage("");
      return;
    }

    setMessage("Регистрация...");
    if (photoUrl) setLineupError("");

    const body: Record<string, string> = {};
    if (clubSlug) body.clubSlug = clubSlug;
    if (participantMode === TournamentParticipantMode.TEAM) body.teamName = teamName.trim();
    if (photoUrl) body.lineupPhotoUrl = photoUrl;

    const response = await fetch(`/api/tournaments/${tournamentId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
      const errorMessage = result.error ?? "Не удалось зарегистрироваться.";
      if (photoUrl) {
        setLineupError(errorMessage);
        setMessage("");
      } else {
        setMessage(errorMessage);
      }
      return;
    }

    setIsOpen(false);
    setLineupOpen(false);
    setRegulationsOpen(false);
    setPendingClubSlug(undefined);
    setLineupPhotoUrl("");
    setLineupError("");
    setMessage("");
    router.refresh();
  };

  const uploadLineupPhoto = async (file?: File) => {
    if (!file) return;

    const allowedTypes = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setLineupError("Поддерживаются JPG, PNG, WebP и AVIF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLineupError("Максимальный размер фото — 10 МБ.");
      return;
    }

    setLineupUploading(true);
    setLineupError("");
    try {
      setLineupPhotoUrl(await uploadFile(file, "lineups"));
    } catch (error) {
      setLineupError(error instanceof Error ? error.message : "Не удалось загрузить фото состава.");
    } finally {
      setLineupUploading(false);
    }
  };

  const submitLineupApplication = () => {
    startTransition(async () => {
      await submitRegistration(pendingClubSlug, lineupPhotoUrl);
    });
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

  const lineupModal = lineupOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4">
      <Card className="w-full max-w-xl overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-xl font-semibold text-white">
              <ImagePlus className="h-5 w-5 text-primary" />
              Фото игрового состава
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Прикрепите один чёткий скриншот, где виден весь заявленный состав. После отправки заявку проверит администратор.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setLineupOpen(false)} aria-label="Закрыть загрузку фото">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {lineupPhotoUrl ? (
            <div className="overflow-hidden rounded-md border border-primary/25 bg-black/30">
              <div className="relative aspect-[16/9]">
                <Image
                  src={lineupPhotoUrl}
                  alt="Предпросмотр фото игрового состава"
                  fill
                  sizes="(min-width: 640px) 560px, 100vw"
                  className="object-contain"
                />
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/10 px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs font-medium text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" /> Фото загружено
                </span>
                <Button type="button" size="sm" variant="ghost" className="text-rose-200" onClick={() => setLineupPhotoUrl("")}>
                  <Trash2 className="mr-2 h-4 w-4" /> Удалить
                </Button>
              </div>
            </div>
          ) : (
            <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.025] p-6 text-center transition hover:border-primary/40 hover:bg-primary/[0.04] focus-within:ring-2 focus-within:ring-primary">
              <input
                type="file"
                accept="image/avif,image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={lineupUploading}
                onChange={(event) => {
                  void uploadLineupPhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {lineupUploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-primary" />}
              <span className="mt-3 font-semibold text-white">{lineupUploading ? "Загружаем фото..." : "Выбрать фото состава"}</span>
              <span className="mt-1 text-xs leading-5 text-zinc-500">JPG, PNG, WebP или AVIF · до 10 МБ</span>
            </label>
          )}

          {lineupError ? <div role="alert" className="rounded-md border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{lineupError}</div> : null}

          <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3 text-sm leading-6 text-amber-100">
            До одобрения вы не будете добавлены в список участников турнира.
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:flex sm:justify-end">
            <Button variant="outline" onClick={() => setLineupOpen(false)}>
              Назад
            </Button>
            <Button onClick={submitLineupApplication} disabled={!lineupPhotoUrl || lineupUploading || isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {isPending ? "Отправляем..." : "Отправить заявку"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  ) : null;

  if (clubSelectionMode === ClubSelectionMode.ADMIN_RANDOM && participantMode !== TournamentParticipantMode.TEAM) {
    return (
      <div className="space-y-2">
        <Button size="lg" onClick={() => submit()} disabled={isPending}>
          {isPending ? "Регистрация..." : "Зарегистрироваться"}
        </Button>
        {message ? <div aria-live="polite" className="text-sm text-red-300">{message}</div> : null}
        {regulationsModal}
        {lineupModal}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Button size="lg" onClick={openClubSelection} disabled={isPending}>
          {isPending ? "Проверяем..." : "Зарегистрироваться"}
        </Button>
        {message ? <div aria-live="polite" className="text-sm text-red-300">{message}</div> : null}
        {regulationsModal}
        {lineupModal}
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4">
          <Card className="flex max-h-[92svh] w-full max-w-3xl flex-col gap-4 overflow-hidden p-4 sm:gap-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Выберите клуб</h3>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-zinc-400 sm:mt-2">
                  Один клуб может быть только у одного участника. Уже занятые клубы недоступны для выбора.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {participantMode === TournamentParticipantMode.TEAM ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-200">Название команды</span>
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/60"
                  placeholder="Например: Nexon Elite"
                />
                <span className="block text-xs text-zinc-500">Размер состава: {rosterSize} игроков</span>
              </label>
            ) : null}

            {clubSelectionMode === ClubSelectionMode.PLAYER_PICK ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-zinc-200">Поиск клуба</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={clubSearch}
                      onChange={(event) => setClubSearch(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-white/10 bg-black/40 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/60"
                      placeholder="Введите название клуба"
                    />
                  </div>
                </label>

                <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 sm:gap-3">
                  {filteredClubs.map((club) => {
                    const taken = takenClubSlugs.includes(club.slug);
                    const selected = selectedClubSlug === club.slug;

                    return (
                      <button
                        key={club.slug}
                        type="button"
                        disabled={taken}
                        onClick={() => setSelectedClubSlug(club.slug)}
                        className={`group flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl border px-2.5 py-3 text-center transition sm:min-h-[118px] sm:px-3 ${
                          taken
                            ? "cursor-not-allowed border-white/10 bg-white/5 opacity-50"
                            : selected
                              ? "border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(33,241,168,0.18),0_14px_28px_rgba(33,241,168,0.1)]"
                              : "border-white/10 bg-white/[0.03] hover:border-primary/40 hover:bg-white/[0.06]"
                        }`}
                      >
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-black/30 transition sm:h-14 sm:w-14 ${
                            selected ? "border-primary/60" : "border-white/10 group-hover:border-white/20"
                          }`}
                        >
                          <Image src={club.imagePath} alt={club.name} width={56} height={56} className="h-full w-full object-contain p-1" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="line-clamp-2 text-xs font-semibold leading-snug text-white sm:text-sm">{club.name}</div>
                          <div className={`text-[10px] font-medium leading-tight sm:text-xs ${taken ? "text-red-300/80" : selected ? "text-primary" : "text-zinc-500"}`}>
                            {taken ? "Клуб уже занят" : selected ? "Выбран" : "Свободен"}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {!filteredClubs.length ? (
                    <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-zinc-500 sm:col-span-3">
                      Клубы по запросу не найдены.
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-400">
                {availableClubs.length ? `Свободно клубов: ${availableClubs.length}` : "Свободных клубов больше нет."}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                <Button variant="outline" className="h-11 px-3" onClick={() => setIsOpen(false)}>
                  Отмена
                </Button>
                <Button
                  className="h-11 px-3"
                  onClick={clubSelectionMode === ClubSelectionMode.PLAYER_PICK ? submitSelectedClub : () => submit(undefined)}
                  disabled={
                    isPending ||
                    (clubSelectionMode === ClubSelectionMode.PLAYER_PICK && !selectedClubSlug) ||
                    (participantMode === TournamentParticipantMode.TEAM && teamName.trim().length < 2)
                  }
                >
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
