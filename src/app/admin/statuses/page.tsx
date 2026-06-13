import { Award, CheckCircle2, Clock3, ExternalLink, ShieldCheck, Sparkles, XCircle, Youtube } from "lucide-react";
import { ProfileStatusApprovalStatus, ProfileStatusType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ProfileStatusBadge } from "@/components/profile/profile-status-badge";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { manualProfileStatusDrafts, notifyExpiredProfileStatuses } from "@/lib/profile-statuses";
import { formatDate } from "@/lib/utils";

const approvalBadge: Record<ProfileStatusApprovalStatus, { label: string; variant: "neutral" | "success" | "danger" }> = {
  PENDING: { label: "На проверке", variant: "neutral" },
  APPROVED: { label: "Выдан", variant: "success" },
  REJECTED: { label: "Отклонён", variant: "danger" },
};

export default async function AdminStatusesPage({
  searchParams,
}: {
  searchParams?: { statusApproved?: string; statusRejected?: string; statusAdded?: string; error?: string };
}) {
  await requirePermission("profileStatuses.manage");
  await notifyExpiredProfileStatuses();

  const statuses = await db.userProfileStatus.findMany({
    include: {
      user: { select: { name: true, email: true } },
      season: { select: { name: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
  });

  const pendingStatuses = statuses.filter((status) => status.approvalStatus === ProfileStatusApprovalStatus.PENDING);
  const approvedCount = statuses.filter((status) => status.approvalStatus === ProfileStatusApprovalStatus.APPROVED).length;
  const rejectedCount = statuses.filter((status) => status.approvalStatus === ProfileStatusApprovalStatus.REJECTED).length;

  return (
    <div className="space-y-6">
      {searchParams?.statusApproved ? (
        <Card className="rounded-lg border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Статус подтверждён и выдан игроку.</Card>
      ) : null}

      {searchParams?.statusRejected ? (
        <Card className="rounded-lg border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Статус отклонён.</Card>
      ) : null}

      {searchParams?.statusAdded ? (
        <Card className="rounded-lg border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-100">
          Добавлено статусов: {searchParams.statusAdded}. Игроку отправлено уведомление.
        </Card>
      ) : null}

      {searchParams?.error ? (
        <Card className="rounded-lg border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">{searchParams.error}</Card>
      ) : null}

      <Card className="rounded-lg overflow-hidden p-0">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Профильные награды
              </div>
              <CardTitle>Статусы игроков</CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                Проверка сезонных наград, история решений и быстрые действия для выдачи статусов в профиль.
              </CardDescription>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-accent">
              <Award className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Clock3 className="h-4 w-4 text-amber-300" />
              На проверке
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">{pendingStatuses.length}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              Выдано
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">{approvedCount}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <XCircle className="h-4 w-4 text-rose-300" />
              Отклонено
            </div>
            <div className="mt-3 text-3xl font-semibold text-white">{rejectedCount}</div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-lg p-0">
        <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(124,58,237,0.16),rgba(59,130,246,0.08),rgba(255,255,255,0.02))] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>Добавить статус игроку</CardTitle>
              <CardDescription className="mt-2 max-w-2xl">
                Введите имя, email, Telegram или публичный ID игрока, выберите один или несколько статусов и выдайте их сразу.
              </CardDescription>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-violet-300/20 bg-violet-500/10 text-violet-100">
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
        </div>

        <form action="/api/admin/profile-statuses" method="post" className="grid gap-5 p-5">
          <div className="grid gap-2">
            <label htmlFor="player" className="text-sm font-semibold text-white">
              Игрок
            </label>
            <input
              id="player"
              name="player"
              placeholder="Например: kumyk007"
              className="h-12 rounded-lg border border-white/10 bg-black/25 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {manualProfileStatusDrafts.map((draft) => {
              const checkboxId = `status-${draft.type.toLowerCase()}`;
              return (
                <div
                  key={draft.type}
                  className="group rounded-lg border border-white/10 bg-black/20 p-4 transition hover:border-primary/30 hover:bg-white/[0.04]"
                >
                  <label htmlFor={checkboxId} className="flex cursor-pointer gap-3">
                    <input id={checkboxId} type="checkbox" name="statusTypes" value={draft.type} className="mt-1 h-4 w-4 accent-primary" />
                    <span className="min-w-0">
                      <ProfileStatusBadge status={draft} className="w-fit" />
                      <span className="mt-3 block text-sm text-zinc-300">{draft.description}</span>
                    </span>
                  </label>
                  {draft.type === ProfileStatusType.AMBASSADOR ? (
                    <div className="mt-3 grid gap-2 pl-7">
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-red-100/70">YouTube-канал</span>
                        <input
                          name="youtubeChannelTitle"
                          placeholder="Название канала"
                          className="h-10 rounded-lg border border-red-300/15 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-300/40 focus:ring-2 focus:ring-red-400/10"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-red-100/70">Ссылка</span>
                        <input
                          name="youtubeUrl"
                          placeholder="https://youtube.com/@channel"
                          className="h-10 rounded-lg border border-red-300/15 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-red-300/40 focus:ring-2 focus:ring-red-400/10"
                        />
                      </label>
                    </div>
                  ) : null}
                  {draft.type === ProfileStatusType.GOAL_MASTER ? (
                    <div className="mt-2 pl-7 text-xs font-semibold text-primary">Временный статус: 3 месяца с момента выдачи</div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <Button type="submit" className="h-12 w-full rounded-lg sm:w-fit">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Добавить выбранные статусы
          </Button>
        </form>
      </Card>

      <div className="grid gap-4">
        {statuses.map((status) => {
          const userName = status.user.name || status.user.email || "Игрок";
          const reviewerName = status.reviewedBy?.name || status.reviewedBy?.email || null;
          const approval = approvalBadge[status.approvalStatus];

          return (
            <Card key={status.id} className="rounded-lg p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-white">{userName}</div>
                    <Badge variant={approval.variant}>{approval.label}</Badge>
                  </div>
                  <ProfileStatusBadge status={status} className="w-fit" />
                  {status.type === ProfileStatusType.AMBASSADOR && status.youtubeUrl ? (
                    <a
                      href={status.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit max-w-full items-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-50 transition hover:border-red-300/40 hover:bg-red-500/15"
                    >
                      <Youtube className="h-4 w-4 fill-current" />
                      <span className="truncate">{status.youtubeChannelTitle ?? "YouTube-канал"}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-red-100/70" />
                    </a>
                  ) : null}
                  <div className="max-w-3xl text-sm text-zinc-400">{status.description}</div>
                  <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                    <span>Сезон: {status.season?.name ?? "Без сезона"}</span>
                    <span>Создан: {formatDate(status.createdAt, "d MMM yyyy")}</span>
                    <span>Срок: {status.expiresAt ? formatDate(status.expiresAt, "d MMM yyyy") : "Без срока"}</span>
                    {status.expiredNotifiedAt ? <span>Окончание отправлено: {formatDate(status.expiredNotifiedAt, "d MMM yyyy")}</span> : null}
                    {reviewerName ? <span>Проверил: {reviewerName}</span> : null}
                  </div>
                </div>

                <div className="grid min-w-[220px] gap-2 sm:grid-cols-2 xl:w-[300px]">
                  <form action={`/api/admin/profile-statuses/${status.id}`} method="post">
                    <input type="hidden" name="_action" value="approve" />
                    <Button type="submit" className="w-full rounded-lg bg-emerald-400 text-black hover:bg-emerald-300" disabled={status.approvalStatus === ProfileStatusApprovalStatus.APPROVED}>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Выдать
                    </Button>
                  </form>
                  <form action={`/api/admin/profile-statuses/${status.id}`} method="post">
                    <input type="hidden" name="_action" value="reject" />
                    <Button type="submit" variant="outline" className="w-full rounded-lg border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20" disabled={status.approvalStatus === ProfileStatusApprovalStatus.REJECTED}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Отклонить
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          );
        })}

        {!statuses.length ? (
          <Card className="rounded-lg border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-500">
            Статусов пока нет. Они появятся здесь после завершения сезона.
          </Card>
        ) : null}
      </div>
    </div>
  );
}

