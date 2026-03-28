"use client";

import { ClubSelectionMode, PlayoffType, SeedingMethod, SortRule, TournamentFormat, TournamentStatus } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { playoffTypeLabel, seedingMethodLabel, sortRuleLabel, tournamentFormatLabel, tournamentStatusLabel } from "@/lib/admin-display";

type BuilderValues = {
  title?: string;
  description?: string;
  rules?: string;
  startsAt?: string;
  endsAt?: string;
  registrationEndsAt?: string;
  maxParticipants?: number;
  prizePool?: string;
  format?: TournamentFormat;
  status?: TournamentStatus;
  coverImage?: string;
  playoffType?: PlayoffType | "";
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
  autoAdvanceFromGroups?: boolean;
  manualBracketControl?: boolean;
  manualPlayoffSelection?: boolean;
  checkInRequired?: boolean;
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
  const [format, setFormat] = useState<TournamentFormat>(initialValues?.format ?? TournamentFormat.SINGLE_ELIMINATION);
  const selectedSortRules = initialValues?.sortRules ?? [SortRule.POINTS, SortRule.GOAL_DIFFERENCE, SortRule.GOALS_FOR, SortRule.WINS];
  const showGroups = format === TournamentFormat.GROUPS || format === TournamentFormat.GROUPS_PLAYOFF;
  const showLeague = format === TournamentFormat.LEAGUE || format === TournamentFormat.ROUND_ROBIN;
  const showPlayoff =
    format === TournamentFormat.SINGLE_ELIMINATION ||
    format === TournamentFormat.DOUBLE_ELIMINATION ||
    format === TournamentFormat.GROUPS_PLAYOFF;

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
            <Label htmlFor="format">Формат</Label>
            <select
              id="format"
              name="format"
              value={format}
              onChange={(event) => setFormat(event.target.value as TournamentFormat)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
            >
              {Object.values(TournamentFormat).map((value) => (
                <option key={value} value={value}>
                  {tournamentFormatLabel[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Дата старта</Label>
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initialValues?.startsAt ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endsAt">Дата завершения</Label>
            <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={initialValues?.endsAt ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="registrationEndsAt">Конец регистрации</Label>
            <Input
              id="registrationEndsAt"
              name="registrationEndsAt"
              type="datetime-local"
              defaultValue={initialValues?.registrationEndsAt ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxParticipants">Лимит участников</Label>
            <Input id="maxParticipants" name="maxParticipants" type="number" min={2} max={256} defaultValue={initialValues?.maxParticipants ?? 16} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prizePool">Призовой фонд</Label>
            <Input id="prizePool" name="prizePool" placeholder="10 000 ₽" defaultValue={initialValues?.prizePool ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImage">Обложка</Label>
            <Input id="coverImage" name="coverImage" placeholder="https://..." defaultValue={initialValues?.coverImage ?? ""} />
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
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Краткая подача турнира, формат и атмосфера сезона."
              defaultValue={initialValues?.description ?? ""}
              required
            />
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

      <Card>
        <CardHeader>
          <CardTitle>Структура турнира</CardTitle>
          <CardDescription>Настройки для лиги, групп и плей-офф с автоматикой и ручным контролем.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {showPlayoff ? (
            <div className="space-y-2">
              <Label htmlFor="playoffType">Тип плей-офф</Label>
              <select
                id="playoffType"
                name="playoffType"
                defaultValue={initialValues?.playoffType ?? (format === TournamentFormat.DOUBLE_ELIMINATION ? PlayoffType.DOUBLE : "")}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
              >
                <option value="">Не использовать</option>
                {Object.values(PlayoffType).map((type) => (
                  <option key={type} value={type}>
                    {playoffTypeLabel[type]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

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

          {showLeague ? (
            <div className="space-y-2">
              <Label htmlFor="roundsInLeague">Кругов в лиге</Label>
              <Input id="roundsInLeague" name="roundsInLeague" type="number" min={1} max={4} defaultValue={initialValues?.roundsInLeague ?? 1} />
            </div>
          ) : null}

          {showGroups ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="groupsCount">Количество групп</Label>
                <Input id="groupsCount" name="groupsCount" type="number" min={1} max={16} defaultValue={initialValues?.groupsCount ?? ""} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="participantsPerGroup">Игроков в группе</Label>
                <Input
                  id="participantsPerGroup"
                  name="participantsPerGroup"
                  type="number"
                  min={2}
                  max={32}
                  defaultValue={initialValues?.participantsPerGroup ?? ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="playoffTeamsPerGroup">Выходят из группы</Label>
                <Input
                  id="playoffTeamsPerGroup"
                  name="playoffTeamsPerGroup"
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={initialValues?.playoffTeamsPerGroup ?? ""}
                />
              </div>
            </>
          ) : null}

          {showLeague || showGroups ? (
            <>
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
            </>
          ) : null}

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
          <CardDescription>Переключатели для матчей, расписания, выхода из групп и ручного контроля плей-офф.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["autoCreateMatches", "Автоматически создать матчи", initialValues?.autoCreateMatches ?? false],
            ["autoCreateSchedule", "Автоматически создать расписание", initialValues?.autoCreateSchedule ?? false],
            ["autoAdvanceFromGroups", "Автоматически выводить из групп", initialValues?.autoAdvanceFromGroups ?? false],
            ["manualBracketControl", "Ручное управление сеткой", initialValues?.manualBracketControl ?? false],
            ["manualPlayoffSelection", "Ручной выбор в плей-офф", initialValues?.manualPlayoffSelection ?? false],
            ["checkInRequired", "Подтверждение участия перед стартом", initialValues?.checkInRequired ?? false],
          ].map(([name, label, checked]) => (
            <label key={String(name)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-300">
              <input type="checkbox" name={String(name)} value="true" defaultChecked={Boolean(checked)} />
              {label}
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit">{submitLabel}</Button>
        {secondaryLabel ? (
          <Button type="submit" name="status" value={TournamentStatus.DRAFT} variant="secondary">
            {secondaryLabel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
