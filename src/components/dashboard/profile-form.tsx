"use client";

import Link from "next/link";
import Image from "next/image";
import { ChangeEvent, useState, useTransition } from "react";
import { ArrowLeft, CalendarDays, Camera, Check, ChevronDown, ImagePlus, Loader2, Save, ShieldCheck } from "lucide-react";
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
    <Card className="profile-editor-shell overflow-hidden">
      <CardContent className="p-0">
        <section className="profile-editor-hero" aria-label="Предпросмотр профиля">
          <div className="profile-editor-banner profile-banner-surface">
            {bannerPreviewSrc ? (
              <Image
                src={bannerPreviewSrc}
                alt=""
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 768px) 100vw, 1280px"
                quality={82}
                className="object-cover"
              />
            ) : null}
            <div className="profile-editor-banner-overlay" />
            <div className="profile-banner-grid absolute inset-0 opacity-20" />
          </div>

          <div className="profile-editor-banner-action">
            <label className="profile-editor-media-button" aria-disabled={uploadingImage !== null}>
              {uploadingImage === "banner" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploadingImage === "banner" ? "Загрузка..." : "Изменить баннер"}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingImage !== null} onChange={(event) => onImageSelect(event, "banner")} />
            </label>
          </div>

          <div className="profile-editor-identity">
            <div className="profile-editor-avatar-wrap">
              <Avatar className="profile-editor-avatar">
                <AvatarImage src={avatarPreview || undefined} alt="Аватар игрока" />
                <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <label className="profile-editor-avatar-button" aria-label="Изменить фото профиля" aria-disabled={uploadingImage !== null}>
                {uploadingImage === "avatar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingImage !== null} onChange={(event) => onImageSelect(event, "avatar")} />
              </label>
            </div>

            <div className="profile-editor-identity-copy">
              <div className="profile-editor-preview-label">Предпросмотр профиля</div>
              <h2>{displayName}</h2>
              {selectedStatuses.length ? (
                <div className="profile-editor-selected-statuses">
                  {selectedStatuses.map((status) => (
                    <ProfileStatusBadge key={status.id} status={status} />
                  ))}
                </div>
              ) : (
                <p className="profile-editor-no-status">Статусы пока не выбраны</p>
              )}
            </div>
          </div>
        </section>

        <div className="profile-editor-layout">
          <div className="profile-editor-main-column">
            <section className="profile-editor-section" aria-labelledby="profile-basic-title">
              <div className="profile-editor-section-heading">
                <div>
                  <h2 id="profile-basic-title">Основная информация</h2>
                  <p>Имя игрока и любимый клуб отображаются в вашем профиле.</p>
                </div>
              </div>

              <div className="profile-editor-fields">
                <div className="profile-editor-field">
                  <Label htmlFor="profile-name">Имя</Label>
                  <Input
                    id="profile-name"
                    value={draft.name}
                    className="profile-editor-control"
                    minLength={3}
                    maxLength={16}
                    pattern="(?!.*__)[A-Za-z0-9][A-Za-z0-9_]{1,14}[A-Za-z0-9]"
                    onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
                  />
                  <div className="profile-editor-field-help">3–16 символов: английские буквы, цифры и `_`. Без `_` в начале, конце и двойного `__`.</div>
                </div>

                <div className="profile-editor-field">
                  <Label htmlFor="profile-favorite-team">Любимый клуб</Label>
                  <div className="profile-editor-select-wrap">
                    <select
                      id="profile-favorite-team"
                      value={draft.favoriteTeam}
                      className="profile-editor-control profile-editor-select"
                      onChange={(e) => setDraft((v) => ({ ...v, favoriteTeam: e.target.value }))}
                    >
                      <option value="" className="bg-[#1D1D1D] text-zinc-300">Не выбран</option>
                      {clubs.map((club) => (
                        <option key={club.slug} value={club.slug} className="bg-[#1D1D1D] text-white">{club.name}</option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </div>
                  <div className="profile-editor-field-help">Клуб появится в основной информации профиля.</div>
                </div>

                <div className="profile-editor-field profile-editor-field-readonly">
                  <div className="profile-editor-label">На сайте с</div>
                  <div className="profile-editor-readonly" aria-label={`Дата регистрации: ${initialValues.registeredAt}`}>
                    <CalendarDays aria-hidden="true" />
                    {initialValues.registeredAt}
                  </div>
                  <div className="profile-editor-field-help">Дата регистрации не редактируется.</div>
                </div>
              </div>
            </section>

            <section className="profile-editor-section" aria-labelledby="profile-bio-title">
              <div className="profile-editor-section-heading profile-editor-section-heading-inline">
                <div>
                  <h2 id="profile-bio-title">Описание профиля</h2>
                  <p>Расскажите о своём стиле игры и достижениях.</p>
                </div>
                <span className="profile-editor-character-count" aria-live="polite">{draft.bio.length}/{PROFILE_BIO_MAX_LENGTH}</span>
              </div>
              <Label htmlFor="profile-bio" className="sr-only">Описание профиля</Label>
              <Textarea
                id="profile-bio"
                rows={5}
                maxLength={PROFILE_BIO_MAX_LENGTH}
                className="profile-editor-bio"
                placeholder="Коротко о себе, стиле игры и достижениях..."
                value={draft.bio}
                onChange={(e) =>
                  setDraft((v) => ({
                    ...v,
                    bio: e.target.value.slice(0, PROFILE_BIO_MAX_LENGTH),
                  }))
                }
              />
              <div className="profile-editor-bio-footer">
                <span>Будет видно всем посетителям профиля</span>
                <span className={bioCharactersLeft < 20 ? "profile-editor-count-warning" : undefined}>Осталось {bioCharactersLeft}</span>
              </div>
            </section>
          </div>

          <aside className="profile-editor-side-column">
            <section className="profile-editor-section profile-editor-status-section" aria-labelledby="profile-status-title">
              <div className="profile-editor-section-heading profile-editor-section-heading-inline">
                <div>
                  <h2 id="profile-status-title">Статусы профиля</h2>
                  <p>Выберите до {MAX_SELECTED_PROFILE_STATUSES} статусов для показа под именем.</p>
                </div>
                <div className="profile-editor-status-count" aria-label={`Выбрано ${selectedStatusIds.length} из ${MAX_SELECTED_PROFILE_STATUSES}`}>
                  {selectedStatusIds.length}/{MAX_SELECTED_PROFILE_STATUSES}
                </div>
              </div>

              <div className="profile-editor-status-grid">
                {statuses.map((status) => {
                  const selected = selectedStatusIds.includes(status.id);

                  return (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => toggleStatus(status.id)}
                      aria-pressed={selected}
                      className={`profile-editor-status-card ${selected ? "is-selected" : ""}`}
                    >
                      <div className="profile-editor-status-card-top">
                        <ProfileStatusBadge status={status} />
                        <span className="profile-editor-status-check" aria-hidden="true">{selected ? <Check /> : null}</span>
                      </div>
                      {selected ? <span className="profile-editor-status-selected-label"><ShieldCheck /> Выбран</span> : null}
                    </button>
                  );
                })}

                {!statuses.length ? (
                  <div className="profile-editor-empty-status">
                    Подтверждённых статусов пока нет. Они появятся здесь после завершения сезона и подтверждения администратором.
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        <div className="profile-editor-actions">
          <div className="profile-editor-save-hint">
            <span className="profile-editor-save-dot" />
            Изменения применятся после сохранения
          </div>
          <div className="profile-editor-action-buttons">
            <Button asChild variant="outline" className="profile-editor-back-button">
              <Link href="/dashboard" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Назад
              </Link>
            </Button>
            <Button onClick={saveProfile} disabled={pending} className="profile-editor-save-button">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {pending ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
