"use client";

import { ChangeEvent, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
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
  const [preview, setPreview] = useState(initialValues.image);
  const [pending, startTransition] = useTransition();

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Выберите изображение для аватара");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      toast.error("Максимальный размер аватара: 4MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setPreview(result);
      setValues((current) => ({ ...current, image: result }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профиль игрока</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-24 w-24 rounded-3xl">
              <AvatarImage src={preview || undefined} alt="Avatar preview" />
              <AvatarFallback>{values.nickname || "EF"}</AvatarFallback>
            </Avatar>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-white">Аватар профиля</div>
                <div className="text-sm text-zinc-400">
                  Фото из Telegram подхватывается автоматически при первом входе. При желании здесь можно заменить его своим изображением.
                </div>
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
            <Input value={values.nickname} onChange={(e) => setValues((v) => ({ ...v, nickname: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>UID eFootball</Label>
            <Input value={values.efootballUid} onChange={(e) => setValues((v) => ({ ...v, efootballUid: e.target.value }))} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Любимая команда</Label>
            <Input value={values.favoriteTeam} onChange={(e) => setValues((v) => ({ ...v, favoriteTeam: e.target.value }))} />
          </div>
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-zinc-400">
            В профиль сохраняется загруженное изображение, а не внешняя ссылка.
          </div>
        </div>

        <Button
          onClick={() =>
            startTransition(async () => {
              const res = await fetch("/api/register", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
              });

              if (!res.ok) {
                toast.error("Не удалось обновить профиль");
                return;
              }

              toast.success("Профиль обновлён");
            })
          }
          disabled={pending}
        >
          {pending ? "Сохраняем..." : "Сохранить профиль"}
        </Button>
      </CardContent>
    </Card>
  );
}
