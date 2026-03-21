"use client";

import { ChangeEvent, useState, useTransition } from "react";
import { ImagePlus, PencilLine, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  initialValues,
}: {
  initialValues: {
    nickname: string;
    efootballUid: string;
    favoriteTeam: string;
    image: string;
  };
}) {
  const [values, setValues] = useState(initialValues);
  const [draft, setDraft] = useState(initialValues);
  const [preview, setPreview] = useState(initialValues.image);
  const [isEditing, setIsEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Для аватара нужно выбрать изображение");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error("Максимальный размер изображения: 4MB");
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
        toast.error("Не удалось сохранить изменения профиля");
        return;
      }

      setValues(draft);
      setIsEditing(false);
      toast.success("Профиль игрока обновлён");
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Профиль игрока</CardTitle>
            <p className="mt-2 text-sm text-zinc-400">
              В этом разделе отображаются основные данные игрока, которые используются в турнирных списках и матчах.
            </p>
          </div>

          {!isEditing ? (
            <Button variant="secondary" onClick={() => setIsEditing(true)} className="gap-2">
              <PencilLine className="h-4 w-4" />
              Редактировать профиль
            </Button>
          ) : (
            <Button variant="outline" onClick={cancelEditing} className="gap-2">
              <X className="h-4 w-4" />
              Закрыть редактор
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-6">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_40%),rgba(255,255,255,0.03)] p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar className="h-24 w-24 rounded-3xl ring-4 ring-white/5">
                <AvatarImage src={(isEditing ? preview : values.image) || undefined} alt="Avatar preview" />
                <AvatarFallback>{values.nickname || "EF"}</AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-2xl font-semibold text-white">{values.nickname || "Игрок без никнейма"}</div>
                  <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                    Профиль активен
                  </div>
                </div>
                <div className="text-sm text-zinc-400">
                  Если игрок вошёл через Telegram, фото профиля подхватывается автоматически. При необходимости его можно заменить вручную.
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Никнейм</div>
                <div className="mt-2 text-sm font-medium text-white">{values.nickname || "Не указан"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">UID</div>
                <div className="mt-2 text-sm font-medium text-white">{values.efootballUid || "Не указан"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Команда</div>
                <div className="mt-2 text-sm font-medium text-white">{values.favoriteTeam || "Не выбрана"}</div>
              </div>
            </div>
          </div>
        </div>

        {isEditing ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold text-white">Редактор профиля</div>
                <div className="text-sm text-zinc-400">Изменения применяются после сохранения и сразу отображаются в кабинете игрока.</div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="h-24 w-24 rounded-3xl">
                    <AvatarImage src={preview || undefined} alt="Avatar preview" />
                    <AvatarFallback>{draft.nickname || "EF"}</AvatarFallback>
                  </Avatar>

                  <div className="space-y-3">
                    <div className="text-sm text-zinc-300">
                      Для профиля можно выбрать новое изображение. Загруженное фото сохранится как часть аккаунта игрока.
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
                  Редактор меняет только данные игрока. Системные настройки и роли в этом разделе не изменяются.
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
      </CardContent>
    </Card>
  );
}
