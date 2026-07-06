"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="page-shell py-12">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Новый пароль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <p className="text-xs text-zinc-400">Минимум 8 символов.</p>
          <Button
            className="w-full"
            disabled={pending || !token}
            onClick={() =>
              startTransition(async () => {
                if (password.length < 8) {
                  toast.error("Пароль должен содержать минимум 8 символов.");
                  return;
                }

                const res = await fetch("/api/password-reset/confirm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token, password }),
                });

                if (!res.ok) {
                  const payload = await res.json().catch(() => null);
                  toast.error(payload?.error || "Не удалось обновить пароль. Запросите сброс заново.");
                  return;
                }

                toast.success("Пароль обновлён");
                router.push("/login");
              })
            }
          >
            Сменить пароль
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
