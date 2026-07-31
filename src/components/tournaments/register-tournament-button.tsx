"use client";

import { ClubSelectionMode, TournamentParticipantMode } from "@prisma/client";
import { ArrowRight, CheckCircle2, ImagePlus, Loader2, Search, ScrollText, Trash2, Upload, UserPlus, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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

type AfterRegulationsAction = "register" | "choose-club" | "create-team";

function normalizeClubSearch(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return mounted ? createPortal(children, document.body) : null;
}

const dialogBackdropClassName =
  "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6";

const dialogPanelClassName =
  "flex max-h-[min(92dvh,760px)] w-full flex-col overflow-hidden rounded-3xl border-primary/20 bg-[#101516] p-0 shadow-[0_24px_80px_rgba(0,0,0,0.45)]";

export function RegisterTournamentButton({
  tournamentId,
  clubSelectionMode,
  participantMode = TournamentParticipantMode.SINGLE,
  rosterSize = 1,
  requireLineupPhoto = false,
  lineupPhotoExampleUrl,
  clubs,
  takenClubSlugs,
}: {
  tournamentId: string;
  clubSelectionMode: ClubSelectionMode;
  participantMode?: TournamentParticipantMode;
  rosterSize?: number;
  requireLineupPhoto?: boolean;
  lineupPhotoExampleUrl?: string | null;
  clubs: ClubOption[];
  takenClubSlugs: string[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClubSlug, setSelectedClubSlug] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamSetupOpen, setTeamSetupOpen] = useState(false);
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
  const modalOpen = isOpen || teamSetupOpen || lineupOpen || regulationsOpen;

  useEffect(() => {
    if (!modalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (lineupOpen) setLineupOpen(false);
      else if (regulationsOpen) setRegulationsOpen(false);
      else if (teamSetupOpen) setTeamSetupOpen(false);
      else setIsOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lineupOpen, modalOpen, regulationsOpen, teamSetupOpen]);

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
      setTeamSetupOpen(false);
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
    setTeamSetupOpen(false);
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

  const openTeamCreation = () => {
    startTransition(async () => {
      setMessage("Проверяем регламент...");

      try {
        const accepted = await loadRegulations();
        setMessage("");

        if (!accepted) {
          await openRegulationsAcceptance(undefined, "create-team");
          return;
        }

        setTeamSetupOpen(true);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Не удалось проверить регламент.");
      }
    });
  };

  const submitTeamCreation = () => {
    if (teamName.trim().length < 2) {
      setMessage("Укажите название команды минимум из 2 символов.");
      return;
    }

    setMessage("");

    if (clubSelectionMode === ClubSelectionMode.PLAYER_PICK) {
      setTeamSetupOpen(false);
      setIsOpen(true);
      return;
    }

    startTransition(async () => {
      await submitRegistration();
    });
  };

  const submitSelectedClub = () => {
    if (participantMode === TournamentParticipantMode.TEAM && teamName.trim().length < 2) {
      setMessage("Сначала укажите название команды.");
      setIsOpen(false);
      setTeamSetupOpen(true);
      return;
    }

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

      if (afterRegulationsAction === "create-team") {
        setMessage("");
        setTeamSetupOpen(true);
        return;
      }

      await submitRegistration(pendingClubSlug);
    });
  };

  const regulationsModal = regulationsOpen ? (
    <ModalPortal>
      <div className={dialogBackdropClassName} role="dialog" aria-modal="true" aria-labelledby="regulations-title">
        <Card className={`${dialogPanelClassName} max-w-3xl`}>
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(33,241,168,0.12),transparent_45%)] p-4 sm:p-5">
            <div className="min-w-0">
              <div id="regulations-title" className="flex items-center gap-2.5 text-lg font-semibold text-white sm:text-xl">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10"><ScrollText className="h-5 w-5 text-primary" /></span>
                Принятие регламента
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Перед регистрацией на турнир нужно прочитать и принять актуальную версию регламента.
              </p>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setRegulationsOpen(false)} aria-label="Закрыть регламент">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="max-h-[48vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-zinc-200">
              <div className="whitespace-pre-wrap">{regulations?.body ?? "Загрузка регламента..."}</div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.07] p-4 text-sm leading-6 text-zinc-100 transition hover:border-primary/35">
              <input
                type="checkbox"
                checked={regulationsAccepted}
                onChange={(event) => setRegulationsAccepted(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 rounded border-white/20 bg-black/40 accent-[#21F1A8]"
              />
              <span>Я прочитал актуальный регламент и принимаю его условия.</span>
            </label>

            {regulationsError ? <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{regulationsError}</div> : null}

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:flex sm:justify-end">
              <Button variant="outline" onClick={() => setRegulationsOpen(false)}>
                Отмена
              </Button>
              <Button onClick={acceptRegulationsAndContinue} disabled={isPending || !regulationsAccepted} className="gap-2 px-3">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span className="truncate">{isPending ? "Сохраняем..." : afterRegulationsAction === "choose-club" ? "Принять и выбрать" : "Принять"}</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ModalPortal>
  ) : null;

  const lineupModal = lineupOpen ? (
    <ModalPortal>
      <div className={dialogBackdropClassName} role="dialog" aria-modal="true" aria-labelledby="lineup-title">
        <Card className={`${dialogPanelClassName} max-w-xl`}>
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(33,241,168,0.12),transparent_45%)] p-4 sm:p-5">
            <div className="min-w-0">
              <div id="lineup-title" className="flex items-center gap-2.5 text-lg font-semibold text-white sm:text-xl">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10"><ImagePlus className="h-5 w-5 text-primary" /></span>
                Фото игрового состава
              </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Прикрепите один чёткий скриншот, где виден весь заявленный состав. После отправки заявку проверит администратор.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setLineupOpen(false)} aria-label="Закрыть загрузку фото">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <section aria-labelledby="lineup-example-title" className="space-y-2">
            <div>
              <h4 id="lineup-example-title" className="text-sm font-semibold text-white">Пример правильного фото состава</h4>
              <p className="mt-1 text-xs leading-5 text-zinc-400">Сделайте похожий скриншот: весь игровой состав должен быть виден целиком.</p>
            </div>
            {lineupPhotoExampleUrl ? (
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-primary/25 bg-black/40 shadow-[0_12px_36px_rgba(0,0,0,0.25)]">
                <Image
                  src={lineupPhotoExampleUrl}
                  alt="Пример правильного фото состава, заданный организатором турнира"
                  fill
                  sizes="(min-width: 640px) 560px, 100vw"
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="flex min-h-28 items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-6 text-zinc-400">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30">
                  <ImagePlus className="h-5 w-5 text-zinc-500" aria-hidden="true" />
                </span>
                Организатор не добавил отдельный пример. Загрузите чёткий скриншот, где виден весь состав.
              </div>
            )}
          </section>

          <div className="border-t border-white/10 pt-4">
            <h4 className="text-sm font-semibold text-white">Ваше фото на проверку</h4>
            <p className="mt-1 text-xs leading-5 text-zinc-400">JPG, PNG, WebP или AVIF · до 10 МБ</p>
          </div>

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
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-primary/35 bg-primary/[0.08] px-4 py-3 text-center font-semibold text-white transition duration-200 hover:border-primary/60 hover:bg-primary/[0.13] focus-within:ring-2 focus-within:ring-primary motion-reduce:transition-none">
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
              {lineupUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
              <span>{lineupUploading ? "Загружаем фото..." : "Выбрать файл"}</span>
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
    </ModalPortal>
  ) : null;

  const teamCreationModal = teamSetupOpen ? (
    <ModalPortal>
      <div className={dialogBackdropClassName} role="dialog" aria-modal="true" aria-labelledby="team-creation-title">
        <Card className={`${dialogPanelClassName} max-w-lg`}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitTeamCreation();
            }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(33,241,168,0.14),transparent_48%)] p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                    <UserPlus className="h-5 w-5 text-primary" />
                  </span>
                  <h3 id="team-creation-title" className="text-lg font-semibold text-white sm:text-xl">
                    Создать команду
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Задайте название команды. После регистрации вы сможете пригласить игроков в состав.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setTeamSetupOpen(false)} aria-label="Закрыть создание команды">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <label className="block space-y-2" htmlFor="team-name-input">
                <span className="text-sm font-medium text-zinc-200">Название команды</span>
                <input
                  id="team-name-input"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 sm:text-sm"
                  placeholder="Например: Nexon Elite"
                  autoComplete="organization"
                  autoFocus
                  aria-describedby="team-name-help"
                />
                <span id="team-name-help" className="block text-xs leading-5 text-zinc-500">
                  Размер состава: {rosterSize} игроков. Вы как капитан будете добавлены первым.
                </span>
              </label>

              {message ? <div role="alert" aria-live="polite" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{message}</div> : null}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 bg-black/20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex sm:justify-end sm:p-5">
              <Button type="button" variant="outline" className="h-11 px-3 sm:min-w-28" onClick={() => setTeamSetupOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" className="h-11 px-3 sm:min-w-44" disabled={isPending || teamName.trim().length < 2}>
                {isPending ? "Регистрация..." : clubSelectionMode === ClubSelectionMode.PLAYER_PICK ? "Продолжить к клубу" : "Создать команду"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </ModalPortal>
  ) : null;

  const registrationTrigger = (onClick: () => void) => (
    <Button
      size="lg"
      onClick={onClick}
      disabled={isPending}
      aria-haspopup="dialog"
      className="group min-h-12 w-full gap-3 overflow-hidden rounded-xl border-primary bg-primary px-5 font-bold text-[#06110d] shadow-[0_12px_32px_rgba(33,241,168,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#58f5bd] hover:shadow-[0_16px_38px_rgba(33,241,168,0.24)] active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none sm:w-auto sm:min-w-60"
    >
      {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
      <span>{isPending ? "Проверяем..." : "Участвовать в турнире"}</span>
      {!isPending ? <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none" /> : null}
    </Button>
  );

  if (clubSelectionMode === ClubSelectionMode.ADMIN_RANDOM && participantMode !== TournamentParticipantMode.TEAM) {
    return (
      <div className="min-w-0 space-y-2">
        {registrationTrigger(() => submit())}
        {message ? <div role="alert" aria-live="polite" className="max-w-sm text-sm leading-5 text-rose-300">{message}</div> : null}
        {regulationsModal}
        {lineupModal}
      </div>
    );
  }

  return (
    <>
      <div className="min-w-0 space-y-2">
        {registrationTrigger(participantMode === TournamentParticipantMode.TEAM ? openTeamCreation : openClubSelection)}
        {message ? <div role="alert" aria-live="polite" className="max-w-sm text-sm leading-5 text-rose-300">{message}</div> : null}
        {regulationsModal}
        {teamCreationModal}
        {lineupModal}
      </div>

      {isOpen ? (
        <ModalPortal>
          <div className={dialogBackdropClassName} role="dialog" aria-modal="true" aria-labelledby="club-selection-title">
          <Card className={`${dialogPanelClassName} max-w-3xl min-w-0 gap-0`}>
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(33,241,168,0.14),transparent_48%)] p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10"><Search className="h-5 w-5 text-primary" /></span>
                  <h3 id="club-selection-title" className="text-lg font-semibold text-white sm:text-xl">
                    {participantMode === TournamentParticipantMode.TEAM ? "Выберите клуб команды" : "Выберите клуб"}
                  </h3>
                </div>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                  Один клуб может быть только у одного участника. Уже занятые клубы недоступны для выбора.
                </p>
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setIsOpen(false)} aria-label="Закрыть выбор клуба">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:gap-5 sm:p-5">
            {clubSelectionMode === ClubSelectionMode.PLAYER_PICK ? (
              <>
                <label className="block shrink-0 space-y-2">
                  <span className="text-sm font-medium text-zinc-200">Поиск клуба</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      value={clubSearch}
                      onChange={(event) => setClubSearch(event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/35 pl-10 pr-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 sm:text-sm"
                      placeholder="Введите название клуба"
                    />
                  </div>
                </label>

                <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-3 sm:gap-3">
                  {filteredClubs.map((club) => {
                    const taken = takenClubSlugs.includes(club.slug);
                    const selected = selectedClubSlug === club.slug;

                    return (
                      <button
                        key={club.slug}
                        type="button"
                        disabled={taken}
                        onClick={() => setSelectedClubSlug(club.slug)}
                        aria-pressed={selected}
                        className={`group relative flex min-h-[126px] min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border px-2.5 py-3 text-center transition duration-200 focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none sm:min-h-[132px] sm:px-3 ${
                          taken
                            ? "cursor-not-allowed border-white/5 bg-[#15191a] opacity-45"
                            : selected
                              ? "border-primary bg-[linear-gradient(180deg,rgba(33,241,168,0.14),rgba(33,241,168,0.06))] shadow-[0_0_0_1px_rgba(33,241,168,0.12),0_14px_30px_rgba(0,0,0,0.22)]"
                              : "border-white/10 bg-[#171c1d] hover:border-primary/40 hover:bg-[#1b2321]"
                        }`}
                      >
                        {selected ? <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[#06110d]"><CheckCircle2 className="h-4 w-4" /></span> : null}
                        <div
                          className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-black/30 transition sm:h-16 sm:w-16 ${
                            selected ? "border-primary/60" : "border-white/10 group-hover:border-white/20"
                          }`}
                        >
                          <Image src={club.imagePath} alt="" width={64} height={64} className="h-full w-full object-contain p-1.5" />
                        </div>
                        <div className="w-full min-w-0 space-y-1">
                          <div className="line-clamp-2 text-xs font-semibold leading-snug text-white sm:text-sm">{club.name}</div>
                          <div className={`text-[11px] font-medium leading-tight ${taken ? "text-rose-300/80" : selected ? "text-primary" : "text-zinc-500"}`}>
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
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-white/10 bg-black/20 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="text-sm text-zinc-400">
                {availableClubs.length ? `Свободно клубов: ${availableClubs.length}` : "Свободных клубов больше нет."}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
                <Button variant="outline" className="h-11 px-3 sm:min-w-28" onClick={() => setIsOpen(false)}>
                  Отмена
                </Button>
                <Button
                  className="h-11 px-3 sm:min-w-44"
                  onClick={clubSelectionMode === ClubSelectionMode.PLAYER_PICK ? submitSelectedClub : () => submit(undefined)}
                  disabled={
                    isPending ||
                    (clubSelectionMode === ClubSelectionMode.PLAYER_PICK && !selectedClubSlug)
                  }
                >
                  {isPending ? "Регистрация..." : participantMode === TournamentParticipantMode.TEAM ? "Зарегистрировать команду" : "Подтвердить выбор"}
                </Button>
              </div>
            </div>
          </Card>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
