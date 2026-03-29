"use client";

import Link from "next/link";
import { ChangeEvent, useState, useTransition } from "react";
import { ArrowLeft, Camera, ImagePlus, Save } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProfileForm({
  initialValues,
}: {
  initialValues: {
    nickname: string;
    favoriteTeam: string;
    bio: string;
    image: string;
    bannerImage: string;
  };
}) {
  const [draft, setDraft] = useState(initialValues);
  const [avatarPreview, setAvatarPreview] = useState(initialValues.image);
  const [bannerPreview, setBannerPreview] = useState(initialValues.bannerImage);
  const [pending, startTransition] = useTransition();

  const displayName = draft.nickname || "Игрок eFootball Nexon";

  const onImageSelect = (event: ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Нужно выбрать изображение.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error("Максимальный размер изображения: 4 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (type === "avatar") {
        setAvatarPreview(result);
        setDraft((current) => ({ ...current, image: result }));
      } else {
        setBannerPreview(result);
        setDraft((current) => ({ ...current, bannerImage: result }));
      }
    };
    reader.readAsDataURL(file);
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

      toast.success("Профиль обновлён.");
      window.location.href = "/dashboard";
    });
  };

  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
      <CardContent className="space-y-6 p-0">
        <div className="relative overflow-hidden border-b border-white/10">
          <div
            className="h-40 bg-[linear-gradient(180deg,rgba(22,33,54,1),rgba(12,18,30,1))] sm:h-52"
            style={bannerPreview ? { backgroundImage: `linear-gradient(180deg, rgba(8,10,16,0.18), rgba(8,10,16,0.7)), url(${bannerPreview})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:36px_36px] opacity-20" />

          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white backdrop-blur-md hover:bg-black/40">
              <ImagePlus className="h-4 w-4 text-primary" />
              Изменить баннер
              <input type="file" accept="image/*" className="hidden" onChange={(event) => onImageSelect(event, "banner")} />
            </label>
          </div>

          <div className="relative px-5 pb-5 sm:px-6">
            <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
                <div className="relative">
                  <Avatar className="h-20 w-20 rounded-[1.75rem] border-4 border-[#101827] shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24">
                    <AvatarImage src={avatarPreview || undefined} alt="Аватар игрока" />
                    <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <label className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-primary text-white shadow-lg hover:bg-primary/90">
                    <Camera className="h-4 w-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => onImageSelect(event, "avatar")} />
                  </label>
                </div>

                <div className="min-w-0 pb-1">
                  <h2 className="truncate text-2xl font-semibold text-white sm:text-3xl">{displayName}</h2>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:self-center">
                <Button asChild variant="outline">
                  <Link href="/dashboard" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Назад к профилю
                  </Link>
                </Button>
                <Button onClick={saveProfile} disabled={pending} className="gap-2">
                  <Save className="h-4 w-4" />
                  {pending ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Никнейм</Label>
              <Input value={draft.nickname} onChange={(e) => setDraft((v) => ({ ...v, nickname: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Любимый клуб</Label>
              <Input value={draft.favoriteTeam} onChange={(e) => setDraft((v) => ({ ...v, favoriteTeam: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Описание профиля</Label>
            <Textarea
              rows={5}
              maxLength={300}
              placeholder="Короткое описание игрока, любимый стиль игры, достижения или любые детали о профиле."
              value={draft.bio}
              onChange={(e) => setDraft((v) => ({ ...v, bio: e.target.value }))}
            />
          </div>

          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-zinc-400">
            Статус профиля: скоро будет. Этот блок подготовлен под следующий этап.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
