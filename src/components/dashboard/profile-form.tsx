"use client";

import { ChangeEvent, useState, useTransition } from "react";
import { Camera, CheckCircle2, ImagePlus, PencilLine, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  initialValues,
  isVerified,
}: {
  initialValues: {
    nickname: string;
    efootballUid: string;
    favoriteTeam: string;
    image: string;
  };
  isVerified: boolean;
}) {
  const [values, setValues] = useState(initialValues);
  const [draft, setDraft] = useState(initialValues);
  const [preview, setPreview] = useState(initialValues.image);
  const [isEditing, setIsEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const displayName = values.nickname || "Игрок eFootball Nexon";

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Для аватара нужно выбрать изображение.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error("Максимальный размер изображения: 4 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setPreview(result);
      setDraft((current) => ({ ...current, image: result }));
    };
    reader.readAsDataURL(file);
  };

  const cancelEditing = () => {
    setDraft(values);
    setPreview(values.image);
    setIsEditing(false);
  };

  const saveProfile = () => {
    startTransition(async () => {
      const res = await fetch("/api/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) {
        toast.error("Не удалось сохранить изменения профиля.");
        return;
      }

      setValues(draft);
      setIsEditing(false);
      toast.success("Профиль обновлён.");
    });
  };

  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
      <CardContent className="space-y-6 p-0">
        <div className="relative overflow-hidden border-b border-white/10">
          <div className="h-32 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,rgba(22,33,54,1),rgba(12,18,30,1))] sm:h-40" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />

          <div className="relative px-5 pb-5 sm:px-6">
            <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
                <div className="relative">
                  <Avatar className="h-20 w-20 rounded-[1.75rem] border-4 border-[#101827] shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24">
                    <AvatarImage src={(isEditing ? preview : values.image) || undefined} alt="Аватар игрока" />
                    <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {isEditing ? (
                    <label className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-primary text-white shadow-lg hover:bg-primary/90">
                      <Camera className="h-4 w-4" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  ) : null}
                </div>

                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-2xl font-semibold text-white sm:text-3xl">{displayName}</h2>
                    {isVerified ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Подтверждён
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {!isEditing ? (
                <Button variant="secondary" onClick={() => setIsEditing(true)} className="gap-2 sm:self-center">
                  <PencilLine className="h-4 w-4" />
                  Редактировать профиль
                </Button>
              ) : (
                <Button variant="outline" onClick={cancelEditing} className="gap-2 sm:self-center">
                  <X className="h-4 w-4" />
                  Закрыть редактор
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          {isEditing ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">Редактор профиля</div>
                  <div className="text-sm text-zinc-400">Изменения сохраняются сразу в аккаунт игрока.</div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Avatar className="h-24 w-24 rounded-3xl">
                      <AvatarImage src={preview || undefined} alt="Аватар игрока" />
                      <AvatarFallback>{(draft.nickname || "EF").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="space-y-3">
                      <div className="text-sm text-zinc-300">
                        Для профиля можно загрузить новое изображение. Оно будет использоваться в кабинете и рядом с игроком.
                      </div>
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10">
                        <ImagePlus className="h-4 w-4 text-primary" />
                        Загрузить фото
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Никнейм</Label>
                    <Input value={draft.nickname} onChange={(e) => setDraft((v) => ({ ...v, nickname: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>UID eFootball</Label>
                    <Input value={draft.efootballUid} onChange={(e) => setDraft((v) => ({ ...v, efootballUid: e.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Любимая команда</Label>
                    <Input value={draft.favoriteTeam} onChange={(e) => setDraft((v) => ({ ...v, favoriteTeam: e.target.value }))} />
                  </div>
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-zinc-400">
                    Галочка подтверждения показывается автоматически, если аккаунт подтверждён через текущую систему входа.
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={saveProfile} disabled={pending} className="sm:min-w-48">
                    {pending ? "Сохранение..." : "Сохранить изменения"}
                  </Button>
                  <Button variant="outline" onClick={cancelEditing}>
                    Отменить
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
