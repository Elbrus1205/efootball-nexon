"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профиль игрока</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <div className="space-y-2">
            <Label>URL аватара</Label>
            <Input value={values.image} onChange={(e) => setValues((v) => ({ ...v, image: e.target.value }))} />
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
