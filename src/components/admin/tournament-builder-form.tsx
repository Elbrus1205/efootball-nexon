"use client";

import { ClubSelectionMode, SeedingMethod, SortRule, TournamentFormat, TournamentStatus } from "@prisma/client";
import type { PlayoffType } from "@prisma/client";
import { ChangeEvent, useState } from "react";
import { seedingMethodLabel, sortRuleLabel, tournamentStatusLabel } from "@/lib/admin-display";
import { FormatBlueprintBuilder } from "@/components/admin/format-blueprint-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type FormatBlueprint } from "@/lib/format-blueprint";

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
  const [coverImage, setCoverImage] = useState(initialValues?.coverImage ?? "");

  const selectedSortRules = initialValues?.sortRules ?? [
    SortRule.POINTS,
    SortRule.GOAL_DIFFERENCE,
    SortRule.GOALS_FOR,
    SortRule.WINS,
  ];

  const optimizeCover = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      reader.onload = () => {
        const source = typeof reader.result === "string" ? reader.result : "";
        const image = new window.Image();

        image.onerror = () => reject(new Error("Не удалось обработать изображение."));
        image.onload = () => {
          const maxSize = 1600;
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Не удалось подготовить изображение."));
            return;
          }

          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/webp", 0.88));
        };

        image.src = source;
      };

      reader.readAsDataURL(file);
    });

  const onCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    try {
      setCoverImage(await optimizeCover(file));
    } catch {
      setCoverImage("");
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
              <span className="text-xs text-blue-100">группы, лига, single/double</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startsAt">Дата старта</Label>
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initialValues?.startsAt ?? ""} required />
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
            <Label htmlFor="prizePool">Призовой фонд</Label>
            <Input id="prizePool" name="prizePool" placeholder="10 000 ₽" defaultValue={initialValues?.prizePool ?? ""} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImageFile">Обложка</Label>
            <input type="hidden" name="coverImage" value={coverImage} />
            <Input id="coverImageFile" type="file" accept="image/*" onChange={onCoverChange} />
            {coverImage ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverImage} alt="Обложка турнира" className="h-32 w-full rounded-xl object-cover" />
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

      <FormatBlueprintBuilder name="formatBlueprintJson" initialValue={initialValues?.formatBlueprint ?? null} visible />

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
