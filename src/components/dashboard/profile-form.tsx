"use client";

import Link from "next/link";
import Image from "next/image";
import { ChangeEvent, useState, useTransition } from "react";
import { ArrowLeft, Camera, ImagePlus, Save, ShieldCheck } from "lucide-react";
import type { ProfileStatusTone, ProfileStatusType } from "@prisma/client";
import { toast } from "sonner";
import type { ClubOption } from "@/lib/clubs";
import { PROFILE_BIO_MAX_LENGTH } from "@/lib/profile";
import { MAX_SELECTED_PROFILE_STATUSES } from "@/lib/profile-status-style";
import { ProfileStatusBadge } from "@/components/profile/profile-status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/lib/storage/upload-client";
import { optimizedImageUrl } from "@/lib/image-optimization";

export function ProfileForm({
  initialValues,
  clubs,
  statuses,
}: {
  initialValues: {
    name: string;
    favoriteTeam: string;
    bio: string;
    image: string;
    bannerImage: string;
    registeredAt: string;
    selectedStatusIds: string[];
  };
  clubs: ClubOption[];
  statuses: Array<{
    id: string;
    title: string;
    description: string;
    tone: ProfileStatusTone;
    type: ProfileStatusType;
    selectedOrder: number | null;
  }>;
}) {
  const [draft, setDraft] = useState(() => ({
    ...initialValues,
    bio: initialValues.bio.slice(0, PROFILE_BIO_MAX_LENGTH),
  }));
  const [avatarPreview, setAvatarPreview] = useState(initialValues.image);
  const [bannerPreview, setBannerPreview] = useState(initialValues.bannerImage);
  const [uploadingImage, setUploadingImage] = useState<"avatar" | "banner" | null>(null);
  const [pending, startTransition] = useTransition();
  const bioCharactersLeft = PROFILE_BIO_MAX_LENGTH - draft.bio.length;
  const selectedStatusIds = draft.selectedStatusIds ?? [];
  const selectedStatuses = selectedStatusIds
    .map((statusId) => statuses.find((status) => status.id === statusId))
    .filter((status): status is (typeof statuses)[number] => Boolean(status));

  const displayName = draft.name || "Игрок eFootball Nexon";
  const bannerPreviewSrc = optimizedImageUrl(bannerPreview, { width: 1600, height: 420, quality: 82, resize: "cover", format: "webp" });

  const toggleStatus = (statusId: string) => {
    setDraft((current) => {
      const currentIds = current.selectedStatusIds ?? [];

      if (currentIds.includes(statusId)) {
        return { ...current, selectedStatusIds: currentIds.filter((id) => id !== statusId) };
      }

      if (currentIds.length >= MAX_SELECTED_PROFILE_STATUSES) {
        toast.error(`Можно выбрать не больше ${MAX_SELECTED_PROFILE_STATUSES} статусов.`);
        return current;
      }

      return { ...current, selectedStatusIds: [...currentIds, statusId] };
    });
  };

  const optimizeImage = (file: File, type: "avatar" | "banner") =>
    new Promise<Blob>((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error("Не удалось прочитать изображение."));
      reader.onload = () => {
        const source = typeof reader.result === "string" ? reader.result : "";
        const image = new window.Image();

        image.onerror = () => reject(new Error("Не удалось обработать изображение."));
        image.onload = () => {
          const maxSize = type === "avatar" ? 512 : 1600;
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
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Не удалось подготовить изображение."));
              }
            },
            "image/webp",
            0.88,
          );
        };

        image.src = source;
      };

      reader.readAsDataURL(file);
    });

  const onImageSelect = async (event: ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") => {
    const file = event.target.files?.[0];
    // Позволяем выбрать тот же файл повторно после ошибки.
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Нужно выбрать изображение.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error("Максимальный размер изображения: 4 MB.");
      return;
    }

    setUploadingImage(type);
    try {
      const optimized = await optimizeImage(file, type);
      const url = await uploadFile(optimized, type === "avatar" ? "avatars" : "banners", `${type}.webp`);
      if (type === "avatar") {
        setAvatarPreview(url);
        setDraft((current) => ({ ...current, image: url }));
      } else {
        setBannerPreview(url);
        setDraft((current) => ({ ...current, bannerImage: url }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось обработать изображение.";
      toast.error(message);
    } finally {
      setUploadingImage(null);
    }
  };

  const saveProfile = () => {
    startTransition(async () => {
      const res = await fetch("/api/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          favoriteTeam: draft.favoriteTeam,
          bio: draft.bio.slice(0, PROFILE_BIO_MAX_LENGTH),
          image: draft.image,
          bannerImage: draft.bannerImage,
          selectedStatusIds: draft.selectedStatusIds,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error(payload?.error || "Не удалось сохранить изменения профиля.");
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
          <div className="profile-banner-surface relative h-40 sm:h-52">
            {bannerPreviewSrc ? (
              <Image
                src={bannerPreviewSrc}
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1120px"
                quality={82}
                className="object-cover"
              />
            ) : null}
            {bannerPreviewSrc ? <div className="absolute inset-0 bg-gradient-to-b from-[rgba(8,10,16,0.18)] to-[rgba(8,10,16,0.7)]" /> : null}
          </div>
          <div className="profile-banner-grid absolute inset-0 opacity-20" />

          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white backdrop-blur-md hover:bg-black/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-60" aria-disabled={uploadingImage !== null}>
              <ImagePlus className="h-4 w-4 text-primary" />
              {uploadingImage === "banner" ? "Загрузка..." : "Изменить баннер"}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingImage !== null} onChange={(event) => onImageSelect(event, "banner")} />
            </label>
          </div>

          <div className="relative px-5 pb-5 sm:px-6">
            <div className="-mt-10 flex items-end justify-between gap-4 sm:-mt-12">
              <div className="flex min-w-0 items-end gap-4">
                <div className="relative inline-flex w-fit self-start">
                  <Avatar className="h-20 w-20 rounded-[1.75rem] border-4 border-[#1D1D1D] shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:h-24 sm:w-24">
                    <AvatarImage src={avatarPreview || undefined} alt="Аватар игрока" />
                    <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <label className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-primary text-white shadow-lg hover:bg-primary/90 aria-disabled:cursor-not-allowed aria-disabled:opacity-60" aria-disabled={uploadingImage !== null}>
                    <Camera className="h-4 w-4" />
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingImage !== null} onChange={(event) => onImageSelect(event, "avatar")} />
                  </label>
                </div>

                <div className="min-w-0 pb-[12px] sm:pb-1">
                  <h2 className="truncate text-[18px] font-semibold leading-none text-white sm:text-3xl">
                    {displayName}
                  </h2>
                  {selectedStatuses.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedStatuses.map((status) => (
                        <ProfileStatusBadge key={status.id} status={status} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">Имя</Label>
                <Input
                  value={draft.name}
                  className="h-10 border-white/10 bg-white/[0.04]"
                  minLength={3}
                  maxLength={16}
                  pattern="(?!.*__)[A-Za-z0-9][A-Za-z0-9_]{1,14}[A-Za-z0-9]"
                  onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
                />
                <div className="text-xs text-zinc-500">3-16 символов: английские буквы, цифры и `_`. Нельзя начинать или заканчивать `_`, а также ставить `__` подряд.</div>
              </div>

              <div className="space-y-2">
                <Label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">Любимый клуб</Label>
                <select
                  value={draft.favoriteTeam}
                  className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-primary"
                  onChange={(e) => setDraft((v) => ({ ...v, favoriteTeam: e.target.value }))}
                >
                  <option value="" className="bg-[#1D1D1D] text-zinc-300">
                    Не выбран
                  </option>
                  {clubs.map((club) => (
                    <option key={club.slug} value={club.slug} className="bg-[#1D1D1D] text-white">
                      {club.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">На сайте с</div>
                <div className="flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-white">
                  {initialValues.registeredAt}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <Label className="mb-2 block text-[11px] uppercase tracking-[0.24em] text-zinc-500">Описание профиля</Label>
            <Textarea
              rows={5}
              maxLength={PROFILE_BIO_MAX_LENGTH}
              className="border-white/10 bg-white/[0.04]"
              placeholder="Короткое описание игрока, любимый стиль игры, достижения или любые детали о профиле."
              value={draft.bio}
              onChange={(e) =>
                setDraft((v) => ({
                  ...v,
                  bio: e.target.value.slice(0, PROFILE_BIO_MAX_LENGTH),
                }))
              }
            />
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Максимум {PROFILE_BIO_MAX_LENGTH} символов</span>
              <span>Осталось {bioCharactersLeft}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="block text-[11px] uppercase tracking-[0.24em] text-zinc-500">Статусы профиля</Label>
                <div className="mt-1 text-sm text-zinc-400">Выберите до {MAX_SELECTED_PROFILE_STATUSES} подтверждённых статусов для показа под именем игрока.</div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-zinc-300">
                {selectedStatusIds.length}/{MAX_SELECTED_PROFILE_STATUSES}
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {statuses.map((status) => {
                const selected = selectedStatusIds.includes(status.id);

                return (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => toggleStatus(status.id)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      selected ? "border-primary/35 bg-primary/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ProfileStatusBadge status={status} />
                      {selected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-100">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Выбран
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-zinc-400">{status.description}</div>
                  </button>
                );
              })}

              {!statuses.length ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-500">
                  Подтверждённых статусов пока нет. Они появятся здесь после завершения сезона и подтверждения администратором.
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-2">
            <Button asChild variant="outline" className="h-14 rounded-2xl text-base">
              <Link href="/dashboard" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Назад к профилю
              </Link>
            </Button>
            <Button onClick={saveProfile} disabled={pending} className="h-14 gap-2 rounded-2xl text-base">
              <Save className="h-4 w-4" />
              {pending ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
