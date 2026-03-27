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
  submitLabel = "РЎРѕР·РґР°С‚СЊ С‚СѓСЂРЅРёСЂ",
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
          <CardTitle>Р‘Р°Р·РѕРІР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ</CardTitle>
          <CardDescription>РќР°Р·РІР°РЅРёРµ, СЃС‚Р°С‚СѓСЃ, РґР°С‚С‹, Р»РёРјРёС‚С‹, РїСЂР°РІРёР»Р° Рё РІРёР·СѓР°Р»СЊРЅР°СЏ РїРѕРґР°С‡Р° С‚СѓСЂРЅРёСЂР°.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">РќР°Р·РІР°РЅРёРµ С‚СѓСЂРЅРёСЂР°</Label>
            <Input id="title" name="title" placeholder="Nexon Champions Cup" defaultValue={initialValues?.title ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">РЎС‚Р°С‚СѓСЃ</Label>
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
            <Label htmlFor="format">Р¤РѕСЂРјР°С‚</Label>
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
            <Label htmlFor="startsAt">Р”Р°С‚Р° СЃС‚Р°СЂС‚Р°</Label>
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initialValues?.startsAt ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endsAt">Р”Р°С‚Р° Р·Р°РІРµСЂС€РµРЅРёСЏ</Label>
            <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={initialValues?.endsAt ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registrationEndsAt">РљРѕРЅРµС† СЂРµРіРёСЃС‚СЂР°С†РёРё</Label>
            <Input id="registrationEndsAt" name="registrationEndsAt" type="datetime-local" defaultValue={initialValues?.registrationEndsAt ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxParticipants">Р›РёРјРёС‚ СѓС‡Р°СЃС‚РЅРёРєРѕРІ</Label>
            <Input id="maxParticipants" name="maxParticipants" type="number" min={2} max={256} defaultValue={initialValues?.maxParticipants ?? 16} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prizePool">РџСЂРёР·РѕРІРѕР№ С„РѕРЅРґ</Label>
            <Input id="prizePool" name="prizePool" placeholder="10 000 в‚Ѕ" defaultValue={initialValues?.prizePool ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coverImage">РћР±Р»РѕР¶РєР°</Label>
            <Input id="coverImage" name="coverImage" placeholder="https://..." defaultValue={initialValues?.coverImage ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="clubSelectionMode">Р РµР¶РёРј РІС‹Р±РѕСЂР° РєР»СѓР±Р°</Label>
            <select
              id="clubSelectionMode"
              name="clubSelectionMode"
              defaultValue={initialValues?.clubSelectionMode ?? ClubSelectionMode.ADMIN_RANDOM}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
            >
              <option value={ClubSelectionMode.ADMIN_RANDOM}>РђРґРјРёРЅ СЂР°СЃРїСЂРµРґРµР»СЏРµС‚ РєР»СѓР±С‹ СЃР»СѓС‡Р°Р№РЅРѕ РїРѕСЃР»Рµ Р·Р°РєСЂС‹С‚РёСЏ СЂРµРіРёСЃС‚СЂР°С†РёРё</option>
              <option value={ClubSelectionMode.PLAYER_PICK}>РЈС‡Р°СЃС‚РЅРёРєРё РІС‹Р±РёСЂР°СЋС‚ РєР»СѓР± СЃР°РјРё РїСЂРё СЂРµРіРёСЃС‚СЂР°С†РёРё</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">РћРїРёСЃР°РЅРёРµ</Label>
            <Textarea id="description" name="description" placeholder="РљСЂР°С‚РєР°СЏ РїРѕРґР°С‡Р° С‚СѓСЂРЅРёСЂР°, С„РѕСЂРјР°С‚ Рё Р°С‚РјРѕСЃС„РµСЂР° СЃРµР·РѕРЅР°." defaultValue={initialValues?.description ?? ""} required />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="rules">РџСЂР°РІРёР»Р°</Label>
            <Textarea id="rules" name="rules" placeholder="РџРѕСЂСЏРґРѕРє РјР°С‚С‡РµР№, РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ, РѕРіСЂР°РЅРёС‡РµРЅРёСЏ Рё СЂРµРіР»Р°РјРµРЅС‚." defaultValue={initialValues?.rules ?? ""} required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>РЎС‚СЂСѓРєС‚СѓСЂР° С‚СѓСЂРЅРёСЂР°</CardTitle>
          <CardDescription>РќР°СЃС‚СЂРѕР№РєРё РґР»СЏ Р»РёРіРё, РіСЂСѓРїРї Рё РїР»РµР№-РѕС„С„ СЃ Р°РІС‚РѕРјР°С‚РёРєРѕР№ Рё СЂСѓС‡РЅС‹Рј РєРѕРЅС‚СЂРѕР»РµРј.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {showPlayoff ? (
            <div className="space-y-2">
              <Label htmlFor="playoffType">РўРёРї РїР»РµР№-РѕС„С„</Label>
              <select
                id="playoffType"
                name="playoffType"
                defaultValue={initialValues?.playoffType ?? (format === TournamentFormat.DOUBLE_ELIMINATION ? PlayoffType.DOUBLE : "")}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
              >
                <option value="">РќРµ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ</option>
                {Object.values(PlayoffType).map((type) => (
                  <option key={type} value={type}>
                    {playoffTypeLabel[type]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="seedingMethod">РџРѕСЃРµРІ</Label>
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
              <Label htmlFor="roundsInLeague">РљСЂСѓРіРѕРІ РІ Р»РёРіРµ</Label>
              <Input id="roundsInLeague" name="roundsInLeague" type="number" min={1} max={4} defaultValue={initialValues?.roundsInLeague ?? 1} />
            </div>
          ) : null}
          {showGroups ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="groupsCount">РљРѕР»РёС‡РµСЃС‚РІРѕ РіСЂСѓРїРї</Label>
                <Input id="groupsCount" name="groupsCount" type="number" min={1} max={16} defaultValue={initialValues?.groupsCount ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="participantsPerGroup">РРіСЂРѕРєРѕРІ РІ РіСЂСѓРїРїРµ</Label>
                <Input id="participantsPerGroup" name="participantsPerGroup" type="number" min={2} max={32} defaultValue={initialValues?.participantsPerGroup ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playoffTeamsPerGroup">Р’С‹С…РѕРґСЏС‚ РёР· РіСЂСѓРїРїС‹</Label>
                <Input id="playoffTeamsPerGroup" name="playoffTeamsPerGroup" type="number" min={1} max={8} defaultValue={initialValues?.playoffTeamsPerGroup ?? ""} />
              </div>
            </>
          ) : null}
          {(showLeague || showGroups) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pointsForWin">РћС‡РєРё Р·Р° РїРѕР±РµРґСѓ</Label>
                <Input id="pointsForWin" name="pointsForWin" type="number" defaultValue={initialValues?.pointsForWin ?? 3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pointsForDraw">РћС‡РєРё Р·Р° РЅРёС‡СЊСЋ</Label>
                <Input id="pointsForDraw" name="pointsForDraw" type="number" defaultValue={initialValues?.pointsForDraw ?? 1} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pointsForLoss">РћС‡РєРё Р·Р° РїРѕСЂР°Р¶РµРЅРёРµ</Label>
                <Input id="pointsForLoss" name="pointsForLoss" type="number" defaultValue={initialValues?.pointsForLoss ?? 0} />
              </div>
            </>
          )}
          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <Label>РџСЂР°РІРёР»Р° СЃРѕСЂС‚РёСЂРѕРІРєРё</Label>
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
          <CardTitle>РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ</CardTitle>
          <CardDescription>РџРµСЂРµРєР»СЋС‡Р°С‚РµР»Рё СЂСѓС‡РЅРѕРіРѕ Рё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРіРѕ СѓРїСЂР°РІР»РµРЅРёСЏ СЃС‚Р°РґРёСЏРјРё, РјР°С‚С‡Р°РјРё Рё СЂР°СЃРїРёСЃР°РЅРёРµРј.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["autoCreateMatches", "РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРѕР·РґР°С‚СЊ РјР°С‚С‡Рё", initialValues?.autoCreateMatches ?? true],
            ["autoCreateSchedule", "РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРѕР·РґР°С‚СЊ СЂР°СЃРїРёСЃР°РЅРёРµ", initialValues?.autoCreateSchedule ?? false],
            ["autoAdvanceFromGroups", "РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РІС‹РІРѕРґРёС‚СЊ РёР· РіСЂСѓРїРї", initialValues?.autoAdvanceFromGroups ?? false],
            ["manualBracketControl", "Р СѓС‡РЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ СЃРµС‚РєРѕР№", initialValues?.manualBracketControl ?? false],
            ["manualPlayoffSelection", "Р СѓС‡РЅРѕР№ РІС‹Р±РѕСЂ РІ РїР»РµР№-РѕС„С„", initialValues?.manualPlayoffSelection ?? false],
            ["checkInRequired", "РџРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ СѓС‡Р°СЃС‚РёСЏ РїРµСЂРµРґ СЃС‚Р°СЂС‚РѕРј", initialValues?.checkInRequired ?? false],
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
