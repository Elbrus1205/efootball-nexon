"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { TournamentApplicationStatus } from "@prisma/client";
import { Check, Clock3, Eye, Loader2, ShieldCheck, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ApplicationItem = {
  id: string;
  status: TournamentApplicationStatus;
  playerName: string;
  publicId: string;
  email: string | null;
  telegramUsername: string | null;
  clubName: string | null;
  teamName: string | null;
  lineupPhotoUrl: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const statusMeta = {
  PENDING: { label: "Ожидает решения", variant: "primary" as const, icon: Clock3 },
  APPROVED: { label: "Принята", variant: "success" as const, icon: Check },
  REJECTED: { label: "Отклонена", variant: "danger" as const, icon: X },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TournamentApplicationManager({
  tournamentId,
  applications,
  enabled,
}: {
  tournamentId: string;
  applications: ApplicationItem[];
  enabled: boolean;
}) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ApplicationItem | null>(null);
  const [previewing, setPreviewing] = useState<ApplicationItem | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pending = useMemo(
    () => applications.filter((application) => application.status === TournamentApplicationStatus.PENDING),
    [applications],
  );
  const processed = useMemo(
    () => applications.filter((application) => application.status !== TournamentApplicationStatus.PENDING),
    [applications],
  );

  const decide = async (application: ApplicationItem, action: "approve" | "reject", rejectionReason?: string) => {
    setProcessingId(application.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { action, reason: rejectionReason } : { action }),
      });
      const result = await response.json().catch(() => ({ error: "Не удалось обработать ответ сервера." }));
      if (!response.ok) throw new Error(result.error ?? "Не удалось обработать заявку.");

      setRejecting(null);
      setReason("");
      setMessage(action === "approve" ? "Игрок зарегистрирован, уведомление отправлено." : "Заявка отклонена, причина отправлена игроку.");
      router.refresh();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Не удалось обработать заявку.");
    } finally {
      setProcessingId(null);
    }
  };

  const renderApplication = (application: ApplicationItem) => {
    const meta = statusMeta[application.status];
    const StatusIcon = meta.icon;
    const isPending = application.status === TournamentApplicationStatus.PENDING;

    return (
      <Card key={application.id} className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setPreviewing(application)}
          className="group relative block aspect-[16/9] w-full overflow-hidden border-b border-white/10 bg-black/35 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Открыть фото состава игрока ${application.playerName}`}
        >
          <Image
            src={application.lineupPhotoUrl}
            alt={`Фото состава игрока ${application.playerName}`}
            fill
            sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
            className="object-contain transition duration-200 group-hover:scale-[1.02]"
          />
          <span className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-md border border-white/15 bg-black/75 px-3 text-xs font-semibold text-white backdrop-blur-sm">
            <Eye className="h-4 w-4" />
            Открыть
          </span>
        </button>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-base font-semibold text-white">{application.playerName}</h2>
              <p className="mt-1 text-xs text-zinc-500">ID {application.publicId} · {formatDate(application.createdAt)}</p>
            </div>
            <Badge variant={meta.variant} className="gap-1.5">
              <StatusIcon className="h-3.5 w-3.5" />
              {meta.label}
            </Badge>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <dt className="text-xs text-zinc-500">Клуб</dt>
              <dd className="mt-1 font-medium text-zinc-100">{application.clubName ?? "Назначит админ"}</dd>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <dt className="text-xs text-zinc-500">Команда / контакт</dt>
              <dd className="mt-1 break-words font-medium text-zinc-100">
                {application.teamName ?? (application.telegramUsername ? `@${application.telegramUsername}` : application.email ?? "Не указан")}
              </dd>
            </div>
          </dl>

          {application.rejectionReason ? (
            <div className="rounded-md border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 text-sm leading-6 text-rose-100">
              Причина: {application.rejectionReason}
            </div>
          ) : null}

          {isPending ? (
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
              <Button
                variant="secondary"
                className="border-rose-400/20 text-rose-100 hover:border-rose-300/40 hover:bg-rose-500/10"
                disabled={Boolean(processingId)}
                onClick={() => {
                  setReason("");
                  setError("");
                  setRejecting(application);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Отклонить
              </Button>
              <Button disabled={Boolean(processingId)} onClick={() => decide(application, "approve")}>
                {processingId === application.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Принять
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Модерация регистрации</div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">Заявки на участие</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Проверьте игровой состав на фото. Одобрение сразу регистрирует игрока, отказ требует понятной причины.
          </p>
        </div>
        <Badge variant={pending.length ? "primary" : "neutral"}>{pending.length} на проверке</Badge>
      </div>

      {!enabled ? (
        <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.08] p-4 text-sm leading-6 text-amber-100">
          Проверка фото выключена в настройках турнира. Старые заявки доступны ниже, новые игроки регистрируются сразу.
        </div>
      ) : null}

      <div aria-live="polite" className="space-y-2">
        {message ? <div className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}
        {error ? <div role="alert" className="rounded-md border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
      </div>

      {pending.length ? (
        <section aria-labelledby="pending-applications" className="space-y-3">
          <h2 id="pending-applications" className="text-sm font-semibold text-zinc-200">Новые заявки</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{pending.map(renderApplication)}</div>
        </section>
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center rounded-md border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <div className="mt-3 font-semibold text-white">Все заявки обработаны</div>
          <p className="mt-1 text-sm text-zinc-500">Новые заявки появятся здесь автоматически.</p>
        </div>
      )}

      {processed.length ? (
        <section aria-labelledby="processed-applications" className="space-y-3">
          <h2 id="processed-applications" className="text-sm font-semibold text-zinc-400">Недавние решения</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{processed.map(renderApplication)}</div>
        </section>
      ) : null}

      <Dialog.Root open={Boolean(previewing)} onOpenChange={(open) => !open && setPreviewing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-white/10 bg-zinc-950 shadow-2xl focus:outline-none">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 p-3 sm:p-4">
              <Dialog.Title className="min-w-0 truncate font-semibold text-white">
                Состав · {previewing?.playerName}
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Закрыть фото"><X className="h-5 w-5" /></Button>
              </Dialog.Close>
            </div>
            <div className="relative min-h-[55dvh] flex-1 bg-black/50">
              {previewing ? <Image src={previewing.lineupPhotoUrl} alt={`Фото состава игрока ${previewing.playerName}`} fill sizes="95vw" className="object-contain" priority /> : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-zinc-950 p-5 shadow-2xl focus:outline-none sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold text-white">Отклонить заявку</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-zinc-400">
                  Игрок получит эту причину в уведомлении и сможет исправить состав и подать заявку заново.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Закрыть"><X className="h-5 w-5" /></Button></Dialog.Close>
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-zinc-200">Причина отказа <span className="text-rose-300">*</span></span>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                placeholder="Например: на фото не виден полный список игроков состава."
                aria-describedby="rejection-help"
                autoFocus
              />
              <span id="rejection-help" className="flex justify-between gap-3 text-xs text-zinc-500">
                <span>Минимум 3 символа</span><span>{reason.trim().length}/500</span>
              </span>
            </label>

            {error ? <div role="alert" className="mt-3 rounded-md border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-100">{error}</div> : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild><Button variant="outline">Отмена</Button></Dialog.Close>
              <Button
                className="border-rose-400/40 text-rose-100 hover:bg-rose-500 hover:text-white"
                disabled={!rejecting || reason.trim().length < 3 || Boolean(processingId)}
                onClick={() => rejecting && decide(rejecting, "reject", reason.trim())}
              >
                {processingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                Отклонить и уведомить
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
