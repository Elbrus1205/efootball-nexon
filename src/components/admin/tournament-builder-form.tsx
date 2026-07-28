"use client";

import {
  ClubSelectionMode,
  MatchupFormat,
  SeedingMethod,
  SortRule,
  TournamentFormat,
  TournamentParticipantMode,
  TournamentStatus,
} from "@prisma/client";
import type { PlayoffType } from "@prisma/client";
import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import Image from "next/image";
import {
  ChartNoAxesColumnIncreasing,
  ImageIcon,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Medal,
  MessageCircle,
  Radio,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Swords,
  Trophy,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { selectableTournamentSeedingMethods, seedingMethodLabel, sortRuleLabel, tournamentStatusLabel } from "@/lib/admin-display";
import { FormatBlueprintBuilder } from "@/components/admin/format-blueprint-builder";
import {
  TournamentBuilderChoice,
  TournamentBuilderField,
  TournamentBuilderNotice,
  TournamentBuilderSection,
  TournamentBuilderToggle,
  tournamentBuilderInputClass,
  tournamentBuilderSelectClass,
} from "@/components/admin/tournament-builder-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormatBlueprint } from "@/lib/format-blueprint";
import { optimizedImageUrl } from "@/lib/image-optimization";
import { uploadFile } from "@/lib/storage/upload-client";

type BuilderValues = {
  title?: string;
  rules?: string;
  startsAt?: string;
  endsAt?: string;
  registrationEndsAt?: string;
  maxParticipants?: number;
  participantMode?: TournamentParticipantMode;
  rosterSize?: number;
  topRankingRestrictionEnabled?: boolean;
  topRankingLimit?: number;
  topRankingPlayerLimit?: number;
  captainsCreateTeamMatches?: boolean;
  matchupFormat?: MatchupFormat;
  bestOfWins?: number;
  isTest?: boolean;
  prizePool?: string;
  format?: TournamentFormat;
  status?: TournamentStatus;
  coverImage?: string;
  lineupPhotoExampleUrl?: string;
  playoffType?: PlayoffType | "";
  playoffLegs?: number;
  playoffThirdPlace?: boolean;
  formatBlueprint?: FormatBlueprint | null;
  seedingMethod?: SeedingMethod;
  roundsInLeague?: number;
  groupsCount?: number | null;
  participantsPerGroup?: number | null;
  playoffTeamsPerGroup?: number | null;
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
  autoCreateMatches?: boolean;
  autoCreateSchedule?: boolean;
  autoOpenRegistration?: boolean;
  autoAdvanceFromGroups?: boolean;
  manualBracketControl?: boolean;
  manualPlayoffSelection?: boolean;
  checkInRequired?: boolean;
  requireLineupPhoto?: boolean;
  telegramCommunityId?: string;
  telegramChannelId?: string;
  telegramGroupId?: string;
  telegramAutoPublish?: boolean;
  clubSelectionMode?: ClubSelectionMode;
  sortRules?: SortRule[];
};

const builderNavigation = [
  { href: "#overview", label: "Основное", icon: LayoutDashboard },
  { href: "#participants", label: "Участники", icon: UsersRound },
  { href: "#structure", label: "Структура", icon: Trophy },
  { href: "#matches", label: "Матчи", icon: Swords },
  { href: "#media", label: "Медиа и правила", icon: ImageIcon },
  { href: "#telegram", label: "Telegram", icon: MessageCircle },
] as const;

const participantModeOptions = [
  {
    value: TournamentParticipantMode.SINGLE,
    title: "Одиночный",
    description: "Один игрок представляет одну турнирную заявку.",
    icon: UserRound,
  },
  {
    value: TournamentParticipantMode.COOP,
    title: "Кооперативный",
    description: "Составы 2v2 или 3v3 с капитаном и приглашениями.",
    icon: UsersRound,
  },
  {
    value: TournamentParticipantMode.TEAM,
    title: "Командный",
    description: "Полноценные команды размером от 2 до 8 игроков.",
    icon: ShieldCheck,
  },
] as const;

const seedingOptions = [
  {
    value: SeedingMethod.MANUAL,
    title: "Ручной",
    description: "Администратор назначает группы и позиции сам.",
    icon: ListChecks,
  },
  {
    value: SeedingMethod.RANDOM,
    title: "Случайный",
    description: "Участники перемешиваются перед распределением.",
    icon: Shuffle,
  },
  {
    value: SeedingMethod.RANKING,
    title: "По рейтингу",
    description: "Сильнейшие участники получают первые номера посева.",
    icon: ChartNoAxesColumnIncreasing,
  },
] as const;

export function TournamentBuilderForm({
  action,
  submitLabel = "Создать турнир",
  secondaryLabel,
  initialValues,
}: {
  action: string;
  submitLabel?: string;
  secondaryLabel?: string;
  initialValues?: BuilderValues;
}) {
  const [coverImage, setCoverImage] = useState(initialValues?.coverImage ?? "");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");
  const [lineupPhotoExampleUrl, setLineupPhotoExampleUrl] = useState(initialValues?.lineupPhotoExampleUrl ?? "");
  const [lineupExampleUploading, setLineupExampleUploading] = useState(false);
  const [lineupExampleUploadError, setLineupExampleUploadError] = useState("");
  const [participantMode, setParticipantMode] = useState(initialValues?.participantMode ?? TournamentParticipantMode.SINGLE);
  const [topRankingRestrictionEnabled, setTopRankingRestrictionEnabled] = useState(initialValues?.topRankingRestrictionEnabled ?? false);
  const [captainsCreateTeamMatches, setCaptainsCreateTeamMatches] = useState(initialValues?.captainsCreateTeamMatches ?? false);
  const [matchupFormat, setMatchupFormat] = useState(initialValues?.matchupFormat ?? MatchupFormat.SINGLE_MATCH);
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(initialValues);
  const uploadsPending = coverUploading || lineupExampleUploading;
  const submitDisabled = uploadsPending || submitting;
  const coverPreviewSrc = optimizedImageUrl(coverImage, {
    width: 1280,
    height: 560,
    quality: 86,
    resize: "cover",
    format: "webp",
  });
  const lineupExamplePreviewSrc = optimizedImageUrl(lineupPhotoExampleUrl, {
    width: 960,
    height: 540,
    quality: 88,
    resize: "contain",
    format: "webp",
  });

  const selectedSortRules = initialValues?.sortRules ?? [
    SortRule.POINTS,
    SortRule.GOAL_DIFFERENCE,
    SortRule.GOALS_FOR,
    SortRule.WINS,
  ];

  const onCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCoverUploadError("Выберите изображение JPG, PNG, WebP или AVIF.");
      event.target.value = "";
      return;
    }

    setCoverUploading(true);
    setCoverUploadError("");

    try {
      const url = await uploadFile(file, "tournaments");
      setCoverImage(url);
    } catch (error) {
      setCoverImage("");
      setCoverUploadError(error instanceof Error ? error.message : "Не удалось загрузить обложку. Попробуйте другое изображение.");
    } finally {
      setCoverUploading(false);
      event.target.value = "";
    }
  };

  const onLineupExampleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLineupExampleUploadError("Выберите изображение JPG, PNG, WebP или AVIF.");
      event.target.value = "";
      return;
    }

    setLineupExampleUploading(true);
    setLineupExampleUploadError("");

    try {
      const url = await uploadFile(file, "tournaments");
      setLineupPhotoExampleUrl(url);
    } catch (error) {
      setLineupPhotoExampleUrl("");
      setLineupExampleUploadError(error instanceof Error ? error.message : "Не удалось загрузить пример фото состава.");
    } finally {
      setLineupExampleUploading(false);
      event.target.value = "";
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.dataset.intent === "draft") {
      const statusField = event.currentTarget.elements.namedItem("status");
      if (statusField instanceof HTMLSelectElement) statusField.value = TournamentStatus.DRAFT;
    }
    setSubmitting(true);
  };

  return (
    <form action={action} method="post" onSubmit={onSubmit} className="min-w-0 space-y-6" aria-busy={submitting}>
      <input type="hidden" name="format" value={TournamentFormat.CUSTOM} />
      <input type="hidden" name="autoCreateMatches" value={String(initialValues?.autoCreateMatches ?? false)} />
      <input type="hidden" name="autoCreateSchedule" value={String(initialValues?.autoCreateSchedule ?? false)} />
      <input type="hidden" name="autoAdvanceFromGroups" value={String(initialValues?.autoAdvanceFromGroups ?? false)} />
      <input type="hidden" name="checkInRequired" value={String(initialValues?.checkInRequired ?? false)} />

      <div className="relative isolate overflow-hidden rounded-2xl border border-primary/20 bg-[#191919] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary/[0.09] blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {isEditing ? "Редактирование" : "Новый турнир"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-zinc-400">
                Гибкий формат
              </span>
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {isEditing ? "Настройка турнира" : "Создание турнира"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Соберите турнир от регистрации до финальной сетки. Все настройки сгруппированы по смыслу и сохраняются одной формой.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[360px]">
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Разделов</div>
              <div className="mt-1 text-lg font-semibold text-white">6</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">Формат</div>
              <div className="mt-1 text-sm font-semibold text-white">Гибкий</div>
            </div>
            <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/[0.06] p-3 sm:col-span-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Сохранение</div>
              <div className="mt-1 text-sm font-semibold text-white">Все настройки</div>
            </div>
          </div>
        </div>
      </div>

      <nav aria-label="Разделы конструктора" className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#191919] p-2 sm:grid-cols-3 xl:hidden">
        {builderNavigation.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[230px_minmax(0,1fr)] xl:items-start">
        <aside className="sticky top-24 hidden rounded-2xl border border-white/10 bg-[#191919] p-3 xl:block">
          <div className="px-3 pb-3 pt-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Навигация</div>
            <div className="mt-1 text-sm font-semibold text-white">Настройки турнира</div>
          </div>
          <nav aria-label="Разделы конструктора" className="space-y-1">
            {builderNavigation.map(({ href, label, icon: Icon }, index) => (
              <a
                key={href}
                href={href}
                className="group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-zinc-500 transition group-hover:border-primary/25 group-hover:text-primary">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">{label}</span>
                <span className="text-[10px] font-bold tabular-nums text-zinc-600">0{index + 1}</span>
              </a>
            ))}
          </nav>
          <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.05] p-3 text-xs leading-5 text-zinc-400">
            Поля с отметкой «Обязательно» проверяются перед отправкой.
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <TournamentBuilderSection
            id="overview"
            number="01"
            icon={LayoutDashboard}
            title="Основная информация"
            description="Название, статус, дата старта и ключевые параметры публикации турнира."
          >
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              <TournamentBuilderField htmlFor="title" label="Название турнира" required className="md:col-span-2">
                <Input
                  id="title"
                  name="title"
                  placeholder="Nexon Champions Cup"
                  defaultValue={initialValues?.title ?? ""}
                  minLength={3}
                  className={tournamentBuilderInputClass}
                  required
                />
              </TournamentBuilderField>

              <TournamentBuilderField htmlFor="status" label="Статус" description="Черновик не виден игрокам до открытия регистрации.">
                <select id="status" name="status" defaultValue={initialValues?.status ?? TournamentStatus.DRAFT} className={tournamentBuilderSelectClass}>
                  {Object.values(TournamentStatus).map((status) => (
                    <option key={status} value={status}>
                      {tournamentStatusLabel[status]}
                    </option>
                  ))}
                </select>
              </TournamentBuilderField>

              <TournamentBuilderField htmlFor="startsAt" label="Дата и время старта" required description="Время указывается по Москве.">
                <Input
                  id="startsAt"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={initialValues?.startsAt ?? ""}
                  className={`${tournamentBuilderInputClass} [color-scheme:dark]`}
                  required
                />
              </TournamentBuilderField>

              <TournamentBuilderField htmlFor="maxParticipants" label="Лимит участников" required description="Допустимое значение: от 2 до 256.">
                <Input
                  id="maxParticipants"
                  name="maxParticipants"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={256}
                  defaultValue={initialValues?.maxParticipants ?? 16}
                  className={tournamentBuilderInputClass}
                  required
                />
              </TournamentBuilderField>

              <TournamentBuilderField htmlFor="prizePool" label="Призовой фонд" description="Можно указать сумму, валюту или текстовое описание.">
                <Input
                  id="prizePool"
                  name="prizePool"
                  placeholder="10 000 ₽"
                  defaultValue={initialValues?.prizePool ?? ""}
                  className={tournamentBuilderInputClass}
                />
              </TournamentBuilderField>

              <TournamentBuilderToggle
                name="autoOpenRegistration"
                title="Открывать регистрацию автоматически"
                description="Регистрация откроется в дату старта, если выбран подходящий статус."
                defaultChecked={initialValues?.autoOpenRegistration ?? false}
                tone="primary"
              />

              <TournamentBuilderToggle
                name="isTest"
                title="Тестовый турнир"
                description="Скрыт от игроков и не отправляет массовые уведомления."
                defaultChecked={initialValues?.isTest ?? false}
                tone="warning"
              />

              <TournamentBuilderNotice className="md:col-span-2">
                Формат турнира всегда гибкий: этапы, лиги, группы и плей-офф настраиваются отдельно в разделе «Структура».
              </TournamentBuilderNotice>
            </div>
          </TournamentBuilderSection>

          <TournamentBuilderSection
            id="participants"
            number="02"
            icon={UsersRound}
            title="Участники и регистрация"
            description="Выберите тип заявок, размер состава, назначение клубов и требования к подтверждению состава."
          >
            <div className="space-y-6">
              <TournamentBuilderField label="Тип участников" required description="От выбранного режима зависит форма регистрации и состав заявки.">
                <div className="grid gap-3 md:grid-cols-3">
                  {participantModeOptions.map((option) => (
                    <TournamentBuilderChoice
                      key={option.value}
                      name="participantMode"
                      value={option.value}
                      title={option.title}
                      description={option.description}
                      icon={option.icon}
                      checked={participantMode === option.value}
                      onChange={() => setParticipantMode(option.value)}
                    />
                  ))}
                </div>
              </TournamentBuilderField>

              {participantMode === TournamentParticipantMode.SINGLE ? <input type="hidden" name="rosterSize" value="1" /> : null}

              <div className="grid gap-5 md:grid-cols-2">
                {participantMode === TournamentParticipantMode.COOP ? (
                  <TournamentBuilderField htmlFor="rosterSize" label="Размер кооперативного состава" required>
                    <select
                      id="rosterSize"
                      name="rosterSize"
                      defaultValue={initialValues?.rosterSize && [2, 3].includes(initialValues.rosterSize) ? initialValues.rosterSize : 2}
                      className={tournamentBuilderSelectClass}
                    >
                      <option value={2}>2 игрока (2v2)</option>
                      <option value={3}>3 игрока (3v3)</option>
                    </select>
                  </TournamentBuilderField>
                ) : null}

                {participantMode === TournamentParticipantMode.TEAM ? (
                  <>
                    <TournamentBuilderField htmlFor="rosterSize" label="Размер команды" required>
                      <select
                        id="rosterSize"
                        name="rosterSize"
                        defaultValue={initialValues?.rosterSize && initialValues.rosterSize >= 2 ? initialValues.rosterSize : 2}
                        className={tournamentBuilderSelectClass}
                      >
                        {[2, 3, 4, 5, 6, 7, 8].map((size) => (
                          <option key={size} value={size}>
                            {size} игроков
                          </option>
                        ))}
                      </select>
                    </TournamentBuilderField>
                    <TournamentBuilderToggle
                      name="topRankingRestrictionEnabled"
                      title="Ограничить игроков из топа рейтинга"
                      description="Приглашение блокируется, если команда превысит заданный лимит игроков из топа."
                      checked={topRankingRestrictionEnabled}
                      onChange={(event) => setTopRankingRestrictionEnabled(event.target.checked)}
                      tone="primary"
                    />
                    {topRankingRestrictionEnabled ? (
                      <>
                        <TournamentBuilderField htmlFor="topRankingLimit" label="Размер топа">
                          <Input id="topRankingLimit" name="topRankingLimit" type="number" min={1} max={500} defaultValue={initialValues?.topRankingLimit ?? 10} className={tournamentBuilderInputClass} />
                        </TournamentBuilderField>
                        <TournamentBuilderField htmlFor="topRankingPlayerLimit" label="Игроков из топа в команде">
                          <Input id="topRankingPlayerLimit" name="topRankingPlayerLimit" type="number" min={1} max={8} defaultValue={initialValues?.topRankingPlayerLimit ?? 1} className={tournamentBuilderInputClass} />
                        </TournamentBuilderField>
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="topRankingLimit" value={initialValues?.topRankingLimit ?? 10} />
                        <input type="hidden" name="topRankingPlayerLimit" value={initialValues?.topRankingPlayerLimit ?? 1} />
                      </>
                    )}
                    <TournamentBuilderToggle
                      name="captainsCreateTeamMatches"
                      title="Капитан хозяев назначает пары игроков"
                      description="Команды в туре формируются автоматически, а соперников игроков выбирает только капитан команды слева."
                      checked={captainsCreateTeamMatches}
                      onChange={(event) => setCaptainsCreateTeamMatches(event.target.checked)}
                      tone="primary"
                    />
                  </>
                ) : null}

                <TournamentBuilderField
                  htmlFor="clubSelectionMode"
                  label="Назначение клубов"
                  description="Выбор игрока проверяется на уникальность внутри турнира."
                  className={participantMode === TournamentParticipantMode.SINGLE ? "md:col-span-2" : undefined}
                >
                  <select
                    id="clubSelectionMode"
                    name="clubSelectionMode"
                    defaultValue={initialValues?.clubSelectionMode ?? ClubSelectionMode.ADMIN_RANDOM}
                    className={tournamentBuilderSelectClass}
                  >
                    <option value={ClubSelectionMode.ADMIN_RANDOM}>Администратор распределяет клубы после регистрации</option>
                    <option value={ClubSelectionMode.PLAYER_PICK}>Участники выбирают клуб при регистрации</option>
                  </select>
                </TournamentBuilderField>
              </div>

              <TournamentBuilderToggle
                name="requireLineupPhoto"
                title="Проверять фото состава"
                description="Перед подтверждением заявки администратор проверит загруженный участником скриншот состава."
                defaultChecked={initialValues?.requireLineupPhoto ?? false}
                tone="primary"
              />

              <TournamentBuilderField
                htmlFor="lineupPhotoExampleFile"
                label="Пример правильного фото состава"
                description="Необязательно. Рекомендуется горизонтальный скриншот 16:9 без лишних элементов интерфейса."
              >
                <input type="hidden" name="lineupPhotoExampleUrl" value={lineupPhotoExampleUrl} />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                  <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 px-5 py-6 text-center transition hover:border-primary/40 hover:bg-primary/[0.04]">
                    {lineupExampleUploading ? <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" /> : <UploadCloud className="h-7 w-7 text-primary" aria-hidden="true" />}
                    <span className="mt-3 text-sm font-semibold text-white">
                      {lineupExampleUploading ? "Загружаем пример..." : "Выбрать изображение"}
                    </span>
                    <span className="mt-1 text-xs text-zinc-500">JPG, PNG, WebP или AVIF</span>
                    <input
                      id="lineupPhotoExampleFile"
                      type="file"
                      accept="image/avif,image/jpeg,image/png,image/webp"
                      onChange={onLineupExampleChange}
                      disabled={lineupExampleUploading}
                      className="sr-only"
                    />
                  </label>

                  {lineupPhotoExampleUrl ? (
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
                      <div className="relative aspect-video bg-black/40">
                        <Image
                          src={lineupExamplePreviewSrc ?? lineupPhotoExampleUrl}
                          alt="Пример правильного фото состава"
                          fill
                          sizes="(min-width: 1024px) 36vw, 100vw"
                          quality={88}
                          className="object-contain"
                        />
                      </div>
                      <Button type="button" variant="ghost" className="w-full rounded-none border-t border-white/10" onClick={() => setLineupPhotoExampleUrl("")}>
                        <X className="mr-2 h-4 w-4" aria-hidden="true" />
                        Убрать пример
                      </Button>
                    </div>
                  ) : (
                    <div className="flex min-h-36 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] px-5 text-center text-sm leading-6 text-zinc-500">
                      После загрузки здесь появится предпросмотр для участников.
                    </div>
                  )}
                </div>
                {lineupExampleUploadError ? <p role="alert" className="text-sm text-red-300">{lineupExampleUploadError}</p> : null}
              </TournamentBuilderField>
            </div>
          </TournamentBuilderSection>

          <TournamentBuilderSection
            id="structure"
            number="03"
            icon={Trophy}
            title="Структура турнира"
            description="Соберите стартовый этап, количество групп или лиг, плей-офф и правила выхода."
          >
            <div className="space-y-6">
              <FormatBlueprintBuilder name="formatBlueprintJson" initialValue={initialValues?.formatBlueprint ?? null} visible />
              <div className="border-t border-white/10 pt-6">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-white">Ручной контроль плей-офф</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Эти параметры полезны для нестандартной сетки и ручного выбора участников.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <TournamentBuilderToggle
                    name="manualBracketControl"
                    title="Ручное управление сеткой"
                    description="Слоты плей-офф можно будет менять вручную из админ-панели."
                    defaultChecked={initialValues?.manualBracketControl ?? false}
                  />
                  <TournamentBuilderToggle
                    name="manualPlayoffSelection"
                    title="Ручной выбор в плей-офф"
                    description="Администратор подтверждает состав следующего этапа самостоятельно."
                    defaultChecked={initialValues?.manualPlayoffSelection ?? false}
                  />
                </div>
              </div>
            </div>
          </TournamentBuilderSection>

          <TournamentBuilderSection
            id="matches"
            number="04"
            icon={Swords}
            title="Матчи, посев и таблица"
            description="Настройте серии матчей, порядок распределения участников и правила подсчёта мест."
          >
            <div className="space-y-7">
              <TournamentBuilderField label="Формат противостояния" required>
                <div className="grid gap-3 md:grid-cols-2">
                  <TournamentBuilderChoice
                    name="matchupFormat"
                    value={MatchupFormat.SINGLE_MATCH}
                    title="Один матч"
                    description="Победитель определяется по результату одной игры."
                    icon={Swords}
                    checked={matchupFormat === MatchupFormat.SINGLE_MATCH}
                    onChange={() => setMatchupFormat(MatchupFormat.SINGLE_MATCH)}
                  />
                  <TournamentBuilderChoice
                    name="matchupFormat"
                    value={MatchupFormat.BEST_OF}
                    title="Серия до побед"
                    description="Участники играют, пока один не наберёт нужное число побед."
                    icon={Medal}
                    checked={matchupFormat === MatchupFormat.BEST_OF}
                    onChange={() => setMatchupFormat(MatchupFormat.BEST_OF)}
                  />
                </div>
              </TournamentBuilderField>

              {matchupFormat === MatchupFormat.SINGLE_MATCH ? <input type="hidden" name="bestOfWins" value="1" /> : null}
              {matchupFormat === MatchupFormat.BEST_OF ? (
                <TournamentBuilderField
                  htmlFor="bestOfWins"
                  label="Побед для выигрыша серии"
                  description="BO3 означает серию до двух побед, BO5 — до трёх."
                  className="max-w-xl"
                >
                  <select
                    id="bestOfWins"
                    name="bestOfWins"
                    defaultValue={initialValues?.bestOfWins && initialValues.bestOfWins > 1 ? initialValues.bestOfWins : 2}
                    className={tournamentBuilderSelectClass}
                  >
                    <option value={2}>До 2 побед (BO3)</option>
                    <option value={3}>До 3 побед (BO5)</option>
                    <option value={4}>До 4 побед (BO7)</option>
                    {[5, 6, 7, 8, 9].map((wins) => (
                      <option key={wins} value={wins}>До {wins} побед</option>
                    ))}
                  </select>
                </TournamentBuilderField>
              ) : null}

              <div className="border-t border-white/10 pt-6">
                <TournamentBuilderField label="Способ посева" required description="Посев применяется при распределении по группам, лигам и слотам плей-офф.">
                  <div className="grid gap-3 md:grid-cols-3">
                    {seedingOptions
                      .filter((option) => selectableTournamentSeedingMethods.includes(option.value))
                      .map((option) => (
                        <TournamentBuilderChoice
                          key={option.value}
                          name="seedingMethod"
                          value={option.value}
                          title={seedingMethodLabel[option.value]}
                          description={option.description}
                          icon={option.icon}
                          defaultChecked={(initialValues?.seedingMethod ?? SeedingMethod.MANUAL) === option.value}
                        />
                      ))}
                  </div>
                </TournamentBuilderField>
              </div>

              <div className="border-t border-white/10 pt-6">
                <div className="grid gap-5 sm:grid-cols-3">
                  <TournamentBuilderField htmlFor="pointsForWin" label="За победу">
                    <Input id="pointsForWin" name="pointsForWin" type="number" inputMode="numeric" min={0} max={10} defaultValue={initialValues?.pointsForWin ?? 3} className={tournamentBuilderInputClass} />
                  </TournamentBuilderField>
                  <TournamentBuilderField htmlFor="pointsForDraw" label="За ничью">
                    <Input id="pointsForDraw" name="pointsForDraw" type="number" inputMode="numeric" min={0} max={10} defaultValue={initialValues?.pointsForDraw ?? 1} className={tournamentBuilderInputClass} />
                  </TournamentBuilderField>
                  <TournamentBuilderField htmlFor="pointsForLoss" label="За поражение">
                    <Input id="pointsForLoss" name="pointsForLoss" type="number" inputMode="numeric" min={0} max={10} defaultValue={initialValues?.pointsForLoss ?? 0} className={tournamentBuilderInputClass} />
                  </TournamentBuilderField>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <TournamentBuilderField label="Правила сортировки" description="Выбранные показатели применяются к таблице этапа в заданном системой порядке.">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Object.values(SortRule).map((rule) => (
                      <TournamentBuilderToggle
                        key={rule}
                        name="sortRules"
                        value={rule}
                        title={sortRuleLabel[rule]}
                        defaultChecked={selectedSortRules.includes(rule)}
                        className="min-h-14"
                      />
                    ))}
                  </div>
                </TournamentBuilderField>
              </div>
            </div>
          </TournamentBuilderSection>

          <TournamentBuilderSection
            id="media"
            number="05"
            icon={ImageIcon}
            title="Медиа и правила"
            description="Добавьте обложку и регламент, которые увидят участники на публичной странице турнира."
          >
            <div className="space-y-7">
              <TournamentBuilderField
                htmlFor="coverImageFile"
                label="Обложка турнира"
                description="Рекомендуемое соотношение 16:7. Изображение будет оптимизировано автоматически."
              >
                <input type="hidden" name="coverImage" value={coverImage} />
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
                  {coverImage ? (
                    <div className="relative aspect-[16/7] min-h-44 bg-black/40">
                      <Image
                        src={coverPreviewSrc ?? coverImage}
                        alt="Обложка турнира"
                        fill
                        sizes="(min-width: 1280px) 900px, 100vw"
                        quality={86}
                        className="object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10">
                        <span className="text-xs font-medium text-zinc-300">Обложка загружена</span>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setCoverImage("")}>
                          <X className="mr-2 h-4 w-4" aria-hidden="true" />
                          Убрать
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center px-6 py-8 text-center transition hover:bg-primary/[0.04]">
                      {coverUploading ? <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" /> : <UploadCloud className="h-8 w-8 text-primary" aria-hidden="true" />}
                      <span className="mt-3 text-sm font-semibold text-white">{coverUploading ? "Загружаем обложку..." : "Загрузить обложку"}</span>
                      <span className="mt-1 text-xs text-zinc-500">JPG, PNG, WebP или AVIF</span>
                      <input id="coverImageFile" type="file" accept="image/*" onChange={onCoverChange} disabled={coverUploading} className="sr-only" />
                    </label>
                  )}
                </div>
                {coverUploadError ? <p role="alert" className="text-sm text-red-300">{coverUploadError}</p> : null}
              </TournamentBuilderField>

              <TournamentBuilderField
                htmlFor="rules"
                label="Правила и регламент"
                required
                description="Минимум 20 символов. Опишите порядок матчей, подтверждение результатов и ограничения."
              >
                <Textarea
                  id="rules"
                  name="rules"
                  placeholder="Порядок матчей, подтверждение результатов, ограничения и регламент турнира."
                  defaultValue={initialValues?.rules ?? ""}
                  minLength={20}
                  rows={8}
                  className="min-h-48 border-white/10 bg-black/30 leading-6 transition hover:border-white/20 focus-visible:border-primary/60 focus-visible:ring-primary/30"
                  required
                />
              </TournamentBuilderField>
            </div>
          </TournamentBuilderSection>

          <TournamentBuilderSection
            id="telegram"
            number="06"
            icon={MessageCircle}
            title="Telegram турнира"
            description="Подключите канал и группу для анонсов, расписания, таблиц, результатов и команд участников."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <TournamentBuilderField
                htmlFor="telegramChannelId"
                label="Канал для публикаций"
                description="Бот должен быть администратором канала с правом публикации."
              >
                <div className="relative">
                  <Radio className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                  <Input
                    id="telegramChannelId"
                    name="telegramChannelId"
                    defaultValue={initialValues?.telegramChannelId ?? ""}
                    placeholder="-1001234567890 или @channel"
                    autoComplete="off"
                    className={`${tournamentBuilderInputClass} pl-11`}
                  />
                </div>
              </TournamentBuilderField>

              <TournamentBuilderField
                htmlFor="telegramGroupId"
                label="Группа участников"
                description="В группе работают команды /mymatch, /deadline, /table и /rules."
              >
                <div className="relative">
                  <UsersRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" aria-hidden="true" />
                  <Input
                    id="telegramGroupId"
                    name="telegramGroupId"
                    defaultValue={initialValues?.telegramGroupId ?? ""}
                    placeholder="-1001234567890"
                    autoComplete="off"
                    className={`${tournamentBuilderInputClass} pl-11`}
                  />
                </div>
              </TournamentBuilderField>

              <TournamentBuilderField
                htmlFor="telegramCommunityId"
                label="ID сообщества Telegram"
                description="Необязательно. Используется для связанного Telegram Community."
                className="md:col-span-2"
              >
                <Input
                  id="telegramCommunityId"
                  name="telegramCommunityId"
                  defaultValue={initialValues?.telegramCommunityId ?? ""}
                  placeholder="ID связанного сообщества"
                  autoComplete="off"
                  className={tournamentBuilderInputClass}
                />
              </TournamentBuilderField>

              <TournamentBuilderToggle
                name="telegramAutoPublish"
                title="Включить автопубликацию"
                description="Telegram будет обновлять единый бюллетень и публиковать карточки регистрации, матчей и итогов."
                defaultChecked={initialValues?.telegramAutoPublish ?? false}
                tone="primary"
                className="md:col-span-2"
              />
            </div>
          </TournamentBuilderSection>

          <div className="sticky bottom-3 z-30 rounded-2xl border border-white/15 bg-[#151515]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" /> : <Settings2 className="h-4 w-4 text-primary" aria-hidden="true" />}
                  {submitting ? "Сохраняем турнир..." : "Настройки готовы к сохранению"}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {uploadsPending ? "Дождитесь завершения загрузки изображений." : "Проверьте обязательные поля перед отправкой."}
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {secondaryLabel ? (
                  <Button
                    type="submit"
                    data-intent="draft"
                    variant="secondary"
                    disabled={submitDisabled}
                    className="w-full sm:w-auto"
                  >
                    <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                    {secondaryLabel}
                  </Button>
                ) : null}
                <Button type="submit" disabled={submitDisabled} className="w-full min-w-44 sm:w-auto">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {submitLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
