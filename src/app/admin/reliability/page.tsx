import { ReliabilityPenaltyScope } from "@prisma/client";
import { Activity, Plus, Save, ShieldMinus, Trash2 } from "lucide-react";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reliabilityPenaltyReasonSchema } from "@/lib/validators";

const editablePenaltyScopes = [ReliabilityPenaltyScope.SCORE_SUBMISSION, ReliabilityPenaltyScope.PLAYER_REPLACEMENT] as const;

const scopeLabels: Record<(typeof editablePenaltyScopes)[number], string> = {
  SCORE_SUBMISSION: "Счет матча",
  PLAYER_REPLACEMENT: "Замена игрока",
};

function assertEditablePenaltyScope(scope: ReliabilityPenaltyScope) {
  if (!editablePenaltyScopes.includes(scope as (typeof editablePenaltyScopes)[number])) {
    throw new Error("Unsupported reliability penalty scope");
  }
}

function formatScopeLabel(scope: ReliabilityPenaltyScope) {
  return scopeLabels[scope as (typeof editablePenaltyScopes)[number]] ?? scope;
}

async function createPenaltyReason(formData: FormData) {
  "use server";

  await requirePermission("reliability.manage");
  const payload = reliabilityPenaltyReasonSchema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    points: formData.get("points"),
    scope: formData.get("scope"),
    isActive: formData.get("isActive") === "on",
  });
  assertEditablePenaltyScope(payload.scope);

  await db.reliabilityPenaltyReason.create({ data: payload });
  revalidatePath("/admin/reliability");
}

async function updatePenaltyReason(formData: FormData) {
  "use server";

  await requirePermission("reliability.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const payload = reliabilityPenaltyReasonSchema.parse({
    title: formData.get("title"),
    description: formData.get("description"),
    points: formData.get("points"),
    scope: formData.get("scope"),
    isActive: formData.get("isActive") === "on",
  });
  assertEditablePenaltyScope(payload.scope);

  await db.reliabilityPenaltyReason.update({
    where: { id },
    data: payload,
  });
  revalidatePath("/admin/reliability");
}

async function deletePenaltyReason(formData: FormData) {
  "use server";

  await requirePermission("reliability.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const reason = await db.reliabilityPenaltyReason.findUnique({
    where: { id },
    select: { scope: true },
  });
  if (!reason) return;
  assertEditablePenaltyScope(reason.scope);

  await db.reliabilityPenaltyReason.delete({
    where: { id },
  });
  revalidatePath("/admin/reliability");
}

export default async function AdminReliabilityPage() {
  await requirePermission("reliability.manage");

  const reasons = await db.reliabilityPenaltyReason.findMany({
    where: {
      scope: { in: [...editablePenaltyScopes] },
    },
    orderBy: [{ createdAt: "desc" }, { title: "asc" }],
  });

  const activeCount = reasons.filter((reason) => reason.isActive).length;
  const latestReason = reasons[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Причины</div>
              <div className="mt-2 text-3xl font-semibold text-white">{reasons.length}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <ShieldMinus className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Активные</div>
              <div className="mt-2 text-3xl font-semibold text-white">{activeCount}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
              <Activity className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Последний штраф</div>
              <div className="mt-2 text-3xl font-semibold text-white">{latestReason ? `-${latestReason.points}` : "—"}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-200">
              <ShieldMinus className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Добавить причину штрафа
          </CardTitle>
          <CardDescription>Причина появится в нужном селекте: при счете матча или замене игрока.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPenaltyReason} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="new-title">Название</Label>
              <Input id="new-title" name="title" placeholder="Неявка на матч" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-points">Штраф</Label>
              <Input id="new-points" name="points" type="number" min={1} max={100} defaultValue={5} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-scope">Где показывать</Label>
              <select id="new-scope" name="scope" defaultValue={ReliabilityPenaltyScope.SCORE_SUBMISSION} className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                {editablePenaltyScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scopeLabels[scope]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="h-11 rounded-md">
              <Plus className="mr-2 h-4 w-4" />
              Добавить
            </Button>
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="new-description">Комментарий для истории надежности</Label>
              <Textarea id="new-description" name="description" placeholder="Коротко объясните, когда применять этот штраф." />
            </div>
            <label className="flex h-11 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-300">
              <input type="checkbox" name="isActive" defaultChecked />
              Активна
            </label>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {reasons.map((reason) => (
          <Card key={reason.id} className="rounded-lg">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{reason.title}</CardTitle>
                  <CardDescription>{formatScopeLabel(reason.scope)} · штраф -{reason.points}</CardDescription>
                </div>
                <span className={reason.isActive ? "rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-200" : "rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-400"}>
                  {reason.isActive ? "Активна" : "Выключена"}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <form action={updatePenaltyReason} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={reason.id} />
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`title-${reason.id}`}>Название</Label>
                  <Input id={`title-${reason.id}`} name="title" defaultValue={reason.title} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`points-${reason.id}`}>Штраф</Label>
                  <Input id={`points-${reason.id}`} name="points" type="number" min={1} max={100} defaultValue={reason.points} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`scope-${reason.id}`}>Где показывать</Label>
                  <select id={`scope-${reason.id}`} name="scope" defaultValue={reason.scope} className="h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white">
                    {editablePenaltyScopes.map((scope) => (
                      <option key={scope} value={scope}>
                        {scopeLabels[scope]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`description-${reason.id}`}>Комментарий</Label>
                  <Textarea id={`description-${reason.id}`} name="description" defaultValue={reason.description ?? ""} />
                </div>
                <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex h-11 items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-300">
                    <input type="checkbox" name="isActive" defaultChecked={reason.isActive} />
                    Показывать в селектах
                  </label>
                  <Button type="submit" className="h-11 rounded-md">
                    <Save className="mr-2 h-4 w-4" />
                    Сохранить
                  </Button>
                </div>
              </form>
              <form action={deletePenaltyReason} className="mt-3 border-t border-white/10 pt-3">
                <input type="hidden" name="id" value={reason.id} />
                <Button type="submit" variant="outline" className="h-11 w-full rounded-md border-red-400/30 text-red-200 hover:bg-red-500/10 hover:text-red-100">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить штраф
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
