"use client";

import { ClubSelectionMode, MatchupFormat, SeedingMethod, SortRule, TournamentFormat, TournamentParticipantMode, TournamentStatus } from "@prisma/client";
import type { PlayoffType } from "@prisma/client";
import { ChangeEvent, useState } from "react";
import Image from "next/image";
import { Radio, Send, UsersRound } from "lucide-react";
import { seedingMethodLabel, sortRuleLabel, tournamentStatusLabel } from "@/lib/admin-display";
import { FormatBlueprintBuilder } from "@/components/admin/format-blueprint-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type FormatBlueprint } from "@/lib/format-blueprint";
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
  requireTelegramForRegistration?: boolean;
  requireLineupPhoto?: boolean;
  telegramCommunityId?: string;
  telegramChannelId?: string;
  telegramGroupId?: string;
  telegramAutoPublish?: boolean;
  clubSelectionMode?: ClubSelectionMode;
  sortRules?: SortRule[];
};

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
  const [matchupFormat, setMatchupFormat] = useState(initialValues?.matchupFormat ?? MatchupFormat.SINGLE_MATCH);
  const coverPreviewSrc = optimizedImageUrl(coverImage, {
    width: 960,
    height: 384,
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
    if (!file.type.startsWith("image/")) return;

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

  return (
    <form action={action} method="post" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Базовая информация</CardTitle>
          <CardDescription>Название, статус, даты, лимиты, правила и визуальная подача турнира.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">Название турнира</Label>
            <Input id="title" name="title" placeholder="Nexon Champions Cup" defaultValue={initialValues?.title ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Статус</Label>
            <select
              id="status"
              name="status"
              defaultValue={initialValues?.status ?? TournamentStatus.DRAFT}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
            >
              {Object.values(TournamentStatus).map((status) => (
                <option key={status} value={status}>
                  {tournamentStatusLabel[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Формат</Label>
            <input type="hidden" name="format" value={TournamentFormat.CUSTOM} />
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
              <span className="font-semibold text-white">Гибкий</span>
              <span className="text-xs text-blue-100">Группы, лига, одиночный или двойной плей-офф</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Дата старта</Label>
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initialValues?.startsAt ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label>Регистрация</Label>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
              <input type="checkbox" name="autoOpenRegistration" value="true" defaultChecked={initialValues?.autoOpenRegistration ?? false} />
              Открывать автоматически по дате старта
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxParticipants">Лимит участников</Label>
            <Input
              id="maxParticipants"
              name="maxParticipants"
              type="number"
              min={2}
              max={256}
              defaultValue={initialValues?.maxParticipants ?? 16}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Тестовый режим</Label>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-zinc-300">
              <input type="checkbox" name="isTest" value="true" defaultChecked={initialValues?.isTest ?? false} />
              Тестовый турнир: скрыт от игроков, уведомления не отправляются
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="participantMode">Тип участников</Label>
            <select
              id="participantMode"
              name="participantMode"
              value={participantMode}
              onChange={(event) => setParticipantMode(event.target.value as TournamentParticipantMode)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
            >
              <option value={TournamentParticipantMode.SINGLE}>Одиночный</option>
              <option value={TournamentParticipantMode.COOP}>Кооперативный</option>
              <option value={TournamentParticipantMode.TEAM}>Командный</option>
            </select>
          </div>

          {participantMode === TournamentParticipantMode.SINGLE ? <input type="hidden" name="rosterSize" value="1" /> : null}

          {participantMode === TournamentParticipantMode.COOP ? (
            <div className="space-y-2">
              <Label htmlFor="rosterSize">Размер состава</Label>
              <select
                id="rosterSize"
                name="rosterSize"
                defaultValue={initialValues?.rosterSize && [2, 3].includes(initialValues.rosterSize) ? initialValues.rosterSize : 2}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
              >
                <option value={2}>2 игрока (2v2)</option>
                <option value={3}>3 игрока (3v3)</option>
              </select>
            </div>
          ) : null}

          {participantMode === TournamentParticipantMode.TEAM ? (
            <div className="space-y-2">
              <Label htmlFor="rosterSize">Размер команды</Label>
              <select
                id="rosterSize"
                name="rosterSize"
                defaultValue={initialValues?.rosterSize && initialValues.rosterSize >= 2 ? initialValues.rosterSize : 2}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
              >
                {[2, 3, 4, 5, 6, 7, 8].map((size) => (
                  <option key={size} value={size}>
                    {size} игроков
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="prizePool">Призовой фонд</Label>
            <Input id="prizePool" name="prizePool" placeholder="10 000 ₽" defaultValue={initialValues?.prizePool ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImageFile">Обложка</Label>
            <input type="hidden" name="coverImage" value={coverImage} />
            <Input id="coverImageFile" type="file" accept="image/*" onChange={onCoverChange} disabled={coverUploading} />
            {coverUploading ? <div className="text-sm text-primary">Загрузка обложки без сжатия...</div> : null}
            {coverUploadError ? <div className="text-sm text-red-300">{coverUploadError}</div> : null}
            {coverImage ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="relative h-32 overflow-hidden rounded-xl bg-black/30">
                  <Image
                    src={coverPreviewSrc ?? coverImage}
                    alt="Обложка турнира"
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    quality={86}
                    className="object-cover"
                  />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => setCoverImage("")}>
                  Убрать обложку
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                Загрузите обложку турнира с устройства.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lineupPhotoExampleFile">Пример фото состава</Label>
            <input type="hidden" name="lineupPhotoExampleUrl" value={lineupPhotoExampleUrl} />
            <Input
              id="lineupPhotoExampleFile"
              type="file"
              accept="image/avif,image/jpeg,image/png,image/webp"
              onChange={onLineupExampleChange}
              disabled={lineupExampleUploading}
            />
            <p className="text-xs leading-5 text-zinc-400">
              Игроки увидят этот пример перед выбором своего скриншота состава.
            </p>
            {lineupExampleUploading ? <div className="text-sm text-primary">Загружаем пример...</div> : null}
            {lineupExampleUploadError ? <div role="alert" className="text-sm text-red-300">{lineupExampleUploadError}</div> : null}
            {lineupPhotoExampleUrl ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="relative aspect-video overflow-hidden rounded-xl bg-black/40">
                  <Image
                    src={lineupExamplePreviewSrc ?? lineupPhotoExampleUrl}
                    alt="Пример правильного фото состава"
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    quality={88}
                    className="object-contain"
                  />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={() => setLineupPhotoExampleUrl("")}>
                  Убрать пример
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                Необязательно. Рекомендуемый формат — горизонтальный скриншот 16:9.
              </div>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="clubSelectionMode">Режим выбора клуба</Label>
            <select
              id="clubSelectionMode"
              name="clubSelectionMode"
              defaultValue={initialValues?.clubSelectionMode ?? ClubSelectionMode.ADMIN_RANDOM}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
            >
              <option value={ClubSelectionMode.ADMIN_RANDOM}>Админ распределяет клубы случайно после закрытия регистрации</option>
              <option value={ClubSelectionMode.PLAYER_PICK}>Участники выбирают клуб сами при регистрации</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="rules">Правила</Label>
            <Textarea
              id="rules"
              name="rules"
              placeholder="Порядок матчей, подтверждение результатов, ограничения и регламент."
              defaultValue={initialValues?.rules ?? ""}
              required
            />
          </div>
        </CardContent>
      </Card>

      <FormatBlueprintBuilder name="formatBlueprintJson" initialValue={initialValues?.formatBlueprint ?? null} visible />

      <Card className="overflow-hidden border-sky-400/20 bg-gradient-to-br from-sky-500/[0.08] via-black/20 to-cyan-500/[0.05]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-sky-300" aria-hidden="true" />
            Telegram турнира
          </CardTitle>
          <CardDescription>
            Подключите канал и группу, чтобы автоматически публиковать rich-анонсы, расписание, таблицы и результаты.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-white">
              <Radio className="h-4 w-4 text-sky-300" aria-hidden="true" />
              Канал для публикаций
            </span>
            <Input
              name="telegramChannelId"
              defaultValue={initialValues?.telegramChannelId ?? ""}
              placeholder="-1001234567890 или @channel"
              autoComplete="off"
            />
            <span className="block text-xs leading-5 text-zinc-400">Бот должен быть администратором канала с правом публикации.</span>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-sm font-medium text-white">
              <UsersRound className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              Группа участников
            </span>
            <Input
              name="telegramGroupId"
              defaultValue={initialValues?.telegramGroupId ?? ""}
              placeholder="-1001234567890"
              autoComplete="off"
            />
            <span className="block text-xs leading-5 text-zinc-400">В группе станут доступны приватные команды /mymatch, /deadline, /table и /rules.</span>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-white">ID сообщества Telegram</span>
            <Input
              name="telegramCommunityId"
              defaultValue={initialValues?.telegramCommunityId ?? ""}
              placeholder="Необязательно — для связанного Telegram Community"
              autoComplete="off"
            />
          </label>

          <label className="flex min-h-14 items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] px-4 py-4 md:col-span-2">
            <input
              type="checkbox"
              name="telegramAutoPublish"
              value="true"
              defaultChecked={initialValues?.telegramAutoPublish ?? false}
              className="mt-1 h-5 w-5 shrink-0 rounded border-white/20 bg-black/40 accent-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            />
            <span>
              <span className="block font-medium text-white">Автопубликация включена</span>
              <span className="mt-1 block text-sm leading-6 text-zinc-300">
                Telegram будет обновлять единый турнирный бюллетень и выпускать аккуратные карточки регистрации, матчей и итогов.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Формат противостояния</CardTitle>
          <CardDescription>Один матч или серия до нужного количества побед.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="matchupFormat">Режим матчей</Label>
            <select
              id="matchupFormat"
              name="matchupFormat"
              value={matchupFormat}
              onChange={(event) => setMatchupFormat(event.target.value as MatchupFormat)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
            >
              <option value={MatchupFormat.SINGLE_MATCH}>Обычный матч</option>
              <option value={MatchupFormat.BEST_OF}>Серия до побед</option>
            </select>
          </div>

          {matchupFormat === MatchupFormat.SINGLE_MATCH ? <input type="hidden" name="bestOfWins" value="1" /> : null}

          {matchupFormat === MatchupFormat.BEST_OF ? (
            <div className="space-y-2">
              <Label htmlFor="bestOfWins">Количество побед для выигрыша серии</Label>
              <select
                id="bestOfWins"
                name="bestOfWins"
                defaultValue={initialValues?.bestOfWins && initialValues.bestOfWins > 1 ? initialValues.bestOfWins : 2}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
              >
                <option value={2}>До 2 побед (BO3)</option>
                <option value={3}>До 3 побед (BO5)</option>
                <option value={4}>До 4 побед (BO7)</option>
                <option value={5}>Пользовательское: до 5 побед</option>
                <option value={6}>Пользовательское: до 6 побед</option>
                <option value={7}>Пользовательское: до 7 побед</option>
                <option value={8}>Пользовательское: до 8 побед</option>
                <option value={9}>Пользовательское: до 9 побед</option>
              </select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Матчи и таблицы</CardTitle>
          <CardDescription>Посев, очки и сортировка таблиц для группового или лигового этапа.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="seedingMethod">Посев</Label>
            <select
              id="seedingMethod"
              name="seedingMethod"
              defaultValue={initialValues?.seedingMethod ?? SeedingMethod.MANUAL}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
            >
              {Object.values(SeedingMethod).map((method) => (
                <option key={method} value={method}>
                  {seedingMethodLabel[method]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pointsForWin">Очки за победу</Label>
            <Input id="pointsForWin" name="pointsForWin" type="number" defaultValue={initialValues?.pointsForWin ?? 3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pointsForDraw">Очки за ничью</Label>
            <Input id="pointsForDraw" name="pointsForDraw" type="number" defaultValue={initialValues?.pointsForDraw ?? 1} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pointsForLoss">Очки за поражение</Label>
            <Input id="pointsForLoss" name="pointsForLoss" type="number" defaultValue={initialValues?.pointsForLoss ?? 0} />
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <Label>Правила сортировки</Label>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {Object.values(SortRule).map((rule) => (
                <label key={rule} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-zinc-300">
                  <input type="checkbox" name="sortRules" value={rule} defaultChecked={selectedSortRules.includes(rule)} />
                  {sortRuleLabel[rule]}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Автоматизация</CardTitle>
          <CardDescription>Настройки ручного контроля плей-офф.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["manualBracketControl", "Ручное управление сеткой", initialValues?.manualBracketControl ?? false],
            ["manualPlayoffSelection", "Ручной выбор в плей-офф", initialValues?.manualPlayoffSelection ?? false],
            ["requireTelegramForRegistration", "Требовать привязанный Telegram для регистрации", initialValues?.requireTelegramForRegistration ?? false],
            ["requireLineupPhoto", "Проверять фото состава перед регистрацией", initialValues?.requireLineupPhoto ?? false],
          ].map(([name, label, checked]) => (
            <label key={String(name)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-300">
              <input type="checkbox" name={String(name)} value="true" defaultChecked={Boolean(checked)} />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={coverUploading || lineupExampleUploading}>
          {submitLabel}
        </Button>
        {secondaryLabel ? (
          <Button type="submit" name="status" value={TournamentStatus.DRAFT} variant="secondary" disabled={coverUploading || lineupExampleUploading}>
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
