"use client";

import { ChangeEvent, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Archive, CalendarClock, ImageIcon, ListChecks, Pause, Play, RotateCcw, Shield, Swords, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { optimizedImageUrl } from "@/lib/image-optimization";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/lib/storage/upload-client";

type AdminMatch = {
  id: string;
  status: string;
  playerOneScore: number | null;
  playerTwoScore: number | null;
  deadlineAt: Date | string;
  playerOne: { name: string | null; email: string | null };
  playerTwo: { name: string | null; email: string | null };
};

type AdminPlayer = {
  userId: string;
  division: number;
  points: number;
  rating: number | null;
  wins: number;
  losses: number;
  user: { name: string | null; email: string | null };
};

type DivisionSettings = {
  betaEnabled: boolean;
  coverImage: string | null;
  phaseStartsAt: Date | string | null;
  phaseEndsAt: Date | string | null;
  rulesText: string | null;
};

type AdminSeason = {
  id: string;
  name: string;
  status: string;
  startsAt: Date | string;
  endsAt: Date | string;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  _count: { archives: number };
};

type ArchiveRow = {
  id: string;
  division: number;
  points: number;
  rating: number | null;
  wins: number;
  draws: number;
  losses: number;
  place: number | null;
  season: { name: string; status: string };
  user: { name: string | null; email: string | null };
};

function name(user: { name: string | null; email: string | null }) {
  return user.name || user.email || "Игрок";
}

function formatDate(value: Date | string | null) {
  if (!value) return "не задано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "не задано";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function toDateTimeLocal(value: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function statusLabel(status: string) {
  if (status === "SCHEDULED") return "Запланирован";
  if (status === "ACTIVE") return "Идет";
  if (status === "PAUSED") return "Пауза";
  if (status === "FINISHED") return "Завершен";
  if (status === "WAITING_GAME") return "Ожидает игру";
  if (status === "WAITING_CONFIRMATION") return "Ожидает подтверждение";
  if (status === "DISPUTED") return "Спорный матч";
  if (status === "FINISHED") return "Завершен";
  if (status === "CANCELLED") return "Отменен";
  return status;
}

function SectionShell({ children }: { children: ReactNode }) {
  return <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:p-5">{children}</section>;
}

export function DivisionAdminPanel({
  settings,
  matches,
  players,
  seasons,
  archivedRows,
  currentStatus,
}: {
  settings: DivisionSettings;
  matches: AdminMatch[];
  players: AdminPlayer[];
  seasons: AdminSeason[];
  archivedRows: ArchiveRow[];
  currentStatus: string;
}) {
  const [tab, setTab] = useState<"seasons" | "settings" | "matches" | "players" | "archive">("seasons");
  const [pending, startTransition] = useTransition();
  const [coverImage, setCoverImage] = useState(settings.coverImage ?? "");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverPreviewSrc = optimizedImageUrl(coverImage, {
    width: 1280,
    height: 720,
    quality: 86,
    resize: "cover",
    format: "webp",
  });
  const router = useRouter();

  const activeSeason = useMemo(() => seasons.find((season) => season.status === "ACTIVE"), [seasons]);
  const tabs = [
    { id: "seasons", label: "Сезоны", icon: CalendarClock },
    { id: "settings", label: "Настройки", icon: Shield },
    { id: "matches", label: "Матчи", icon: Swords },
    { id: "players", label: "Игроки", icon: Users },
    { id: "archive", label: "Архив", icon: Archive },
  ] as const;

  const onCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setCoverUploading(true);
    try {
      const url = await uploadFile(file, "divisions");
      setCoverImage(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить обложку дивизиона.");
    } finally {
      setCoverUploading(false);
      event.target.value = "";
    }
  };

  function postSeason(body: unknown, success = "Сезон обновлен.") {
    startTransition(async () => {
      const res = await fetch("/api/admin/divisions/seasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Действие не выполнено.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function patchMatch(matchId: string, body: unknown) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/divisions/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(payload?.error || "Действие не выполнено.");
        return;
      }
      toast.success("Матч обновлен.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <SectionShell>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Админка дивизионов</h1>
            <div className="mt-1 text-sm text-zinc-400">
              {activeSeason ? `Активный сезон: ${activeSeason.name}, до ${formatDate(activeSeason.endsAt)}` : "Активного сезона нет"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-bold", tab === item.id ? "border-primary/40 bg-primary/15 text-white" : "border-white/10 bg-black/20 text-zinc-400 hover:text-white")}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </SectionShell>

      {tab === "seasons" ? (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <SectionShell>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                postSeason(
                  {
                    action: "create",
                    name: form.get("name"),
                    startsAt: form.get("startsAt"),
                    endsAt: form.get("endsAt"),
                  },
                  "Сезон создан.",
                );
                event.currentTarget.reset();
              }}
            >
              <div>
                <h2 className="text-lg font-black text-white">Новый сезон</h2>
                <p className="text-sm text-zinc-400">Название, начало и конец. Если дата уже наступила, сезон включится сразу.</p>
              </div>
              <Input name="name" placeholder="Например: Сезон 1" required className="bg-black/30" />
              <Input name="startsAt" type="datetime-local" required className="bg-black/30" />
              <Input name="endsAt" type="datetime-local" required className="bg-black/30" />
              <Button disabled={pending} type="submit" className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Создать сезон
              </Button>
            </form>
          </SectionShell>

          <SectionShell>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Список сезонов</h2>
              <Button disabled={pending} type="button" variant="outline" onClick={() => postSeason({ action: "clear" }, "Сезоны очищены.")}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Очистить сезоны
              </Button>
            </div>
            <div className="grid gap-3">
              {seasons.map((season) => (
                <div key={season.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-white">{season.name}</span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs font-bold text-zinc-300">{statusLabel(season.status)}</span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">{formatDate(season.startsAt)} - {formatDate(season.endsAt)} · архив: {season._count.archives}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={pending || season.status === "ACTIVE"} type="button" onClick={() => postSeason({ action: "start", seasonId: season.id })}>Начать</Button>
                      <Button disabled={pending || season.status !== "ACTIVE"} type="button" variant="outline" onClick={() => postSeason({ action: "pause", seasonId: season.id })}>
                        <Pause className="mr-2 h-4 w-4" />
                        Остановить
                      </Button>
                      <Button disabled={pending || season.status !== "PAUSED"} type="button" variant="outline" onClick={() => postSeason({ action: "resume", seasonId: season.id })}>Продолжить</Button>
                      <Button disabled={pending || season.status === "FINISHED"} type="button" variant="outline" onClick={() => postSeason({ action: "finish", seasonId: season.id }, "Сезон завершен и архив сохранен.")}>Закончить</Button>
                    </div>
                  </div>
                </div>
              ))}
              {!seasons.length ? <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">Сезонов пока нет.</div> : null}
            </div>
          </SectionShell>
        </div>
      ) : null}

      {tab === "settings" ? (
        <SectionShell>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              startTransition(async () => {
                await fetch("/api/admin/divisions/settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    betaEnabled: form.get("betaEnabled") === "on",
                    coverImage,
                    phaseStartsAt: form.get("phaseStartsAt"),
                    phaseEndsAt: form.get("phaseEndsAt"),
                    rulesText: form.get("rulesText"),
                  }),
                });
                toast.success("Настройки дивизиона сохранены.");
                router.refresh();
              });
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Настройки режима</h2>
                <p className="text-sm text-zinc-400">Обложка, ручное включение beta и правила.</p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white">
                <input name="betaEnabled" type="checkbox" defaultChecked={settings.betaEnabled} />
                Beta включена
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-400 md:col-span-2">
                Обложка карточки дивизиона 16:9
                <input type="hidden" name="coverImage" value={coverImage} />
                <Input type="file" accept="image/*" onChange={onCoverChange} disabled={coverUploading} className="bg-black/30" />
              </label>
              {coverImage ? (
                <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-3 md:col-span-2">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-black/30">
                    <Image
                      src={coverPreviewSrc ?? coverImage}
                      alt="Фон карточки дивизиона"
                      fill
                      sizes="(min-width: 768px) 720px, 100vw"
                      quality={86}
                      className="object-cover"
                    />
                  </div>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setCoverImage("")}>Убрать фон</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400 md:col-span-2">
                  <ImageIcon className="h-4 w-4" />
                  Загрузите горизонтальную картинку для карточки дивизиона.
                </div>
              )}
              <Input name="phaseStartsAt" type="datetime-local" defaultValue={toDateTimeLocal(settings.phaseStartsAt)} className="bg-black/30" />
              <Input name="phaseEndsAt" type="datetime-local" defaultValue={toDateTimeLocal(settings.phaseEndsAt)} className="bg-black/30" />
            </div>
            <label className="block space-y-2 text-sm text-zinc-400">
              Правила
              <textarea name="rulesText" defaultValue={settings.rulesText ?? ""} className="min-h-32 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-primary" />
            </label>
            <Button disabled={pending} type="submit">
              <ListChecks className="mr-2 h-4 w-4" />
              Сохранить настройки
            </Button>
          </form>
        </SectionShell>
      ) : null}

      {tab === "matches" ? (
        <SectionShell>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black text-white">Матчи дивизиона</h2>
            <select value={currentStatus} onChange={(event) => router.push(`/admin/divisions?status=${event.target.value}`)} className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white">
              <option value="all">Все статусы</option>
              <option value="WAITING_GAME">Ожидает игру</option>
              <option value="WAITING_CONFIRMATION">Ожидает подтверждение</option>
              <option value="DISPUTED">Спорные матчи</option>
              <option value="FINISHED">Завершенные</option>
              <option value="CANCELLED">Отмененные</option>
            </select>
          </div>
          <div className="grid gap-3">
            {matches.map((match) => (
              <form key={match.id} className="rounded-lg border border-white/10 bg-black/20 p-4" onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                patchMatch(match.id, { action: "confirm", playerOneScore: Number(form.get("playerOneScore")), playerTwoScore: Number(form.get("playerTwoScore")), adminNote: form.get("adminNote") });
              }}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-bold text-white">{name(match.playerOne)} vs {name(match.playerTwo)}</div>
                    <div className="mt-1 text-xs text-zinc-500">{statusLabel(match.status)} · дедлайн {formatDate(match.deadlineAt)}</div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[80px_80px_1fr_auto_auto]">
                    <Input name="playerOneScore" type="number" min={0} max={99} defaultValue={match.playerOneScore ?? 0} className="h-10 bg-black/30" />
                    <Input name="playerTwoScore" type="number" min={0} max={99} defaultValue={match.playerTwoScore ?? 0} className="h-10 bg-black/30" />
                    <Input name="adminNote" placeholder="Комментарий" className="h-10 bg-black/30" />
                    <Button disabled={pending} type="submit">Подтвердить</Button>
                    <Button disabled={pending} type="button" variant="outline" onClick={() => patchMatch(match.id, { action: "cancel", adminNote: "Отменено администратором" })}>Отменить</Button>
                  </div>
                </div>
              </form>
            ))}
            {!matches.length ? <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">Матчей с этим статусом нет.</div> : null}
          </div>
        </SectionShell>
      ) : null}

      {tab === "players" ? (
        <SectionShell>
          <h2 className="mb-4 text-lg font-black text-white">Игроки</h2>
          <div className="grid gap-3">
            {players.map((player) => (
              <form key={player.userId} className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 lg:grid-cols-[1fr_90px_110px_110px_auto] lg:items-center" onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                startTransition(async () => {
                  const res = await fetch(`/api/admin/divisions/players/${player.userId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ division: Number(form.get("division")), points: Number(form.get("points")), rating: form.get("rating") }),
                  });
                  const payload = await res.json().catch(() => null);
                  if (!res.ok) {
                    toast.error(payload?.error || "Игрок не обновлен.");
                    return;
                  }
                  toast.success("Игрок обновлен.");
                  router.refresh();
                });
              }}>
                <div>
                  <div className="font-bold text-white">{name(player.user)}</div>
                  <div className="text-xs text-zinc-500">{player.wins} побед · {player.losses} поражений</div>
                </div>
                <Input name="division" type="number" min={1} max={5} defaultValue={player.division} className="h-10 bg-black/30" />
                <Input name="points" type="number" min={0} defaultValue={player.points} className="h-10 bg-black/30" />
                <Input name="rating" type="number" min={0} defaultValue={player.rating ?? ""} placeholder="rating" className="h-10 bg-black/30" />
                <Button disabled={pending} type="submit">Сохранить</Button>
              </form>
            ))}
          </div>
        </SectionShell>
      ) : null}

      {tab === "archive" ? (
        <SectionShell>
          <h2 className="mb-4 text-lg font-black text-white">Архив рейтингов</h2>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Сезон</th>
                  <th className="px-3 py-3">Место</th>
                  <th className="px-3 py-3">Игрок</th>
                  <th className="px-3 py-3">Див</th>
                  <th className="px-3 py-3">Очки/рейтинг</th>
                  <th className="px-3 py-3">Статистика</th>
                </tr>
              </thead>
              <tbody>
                {archivedRows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-3 text-zinc-300">{row.season.name}</td>
                    <td className="px-3 py-3 font-black text-white">{row.place ?? "-"}</td>
                    <td className="px-3 py-3">{name(row.user)}</td>
                    <td className="px-3 py-3">Див {row.division}</td>
                    <td className="px-3 py-3 font-bold text-yellow-200">{row.division <= 2 ? row.rating ?? 1000 : row.points}</td>
                    <td className="px-3 py-3 text-zinc-400">{row.wins}-{row.draws}-{row.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!archivedRows.length ? <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">Архив появится после завершения сезона.</div> : null}
          </div>
        </SectionShell>
      ) : null}
    </div>
  );
}
