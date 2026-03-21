"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
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
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button
            className="w-full"
            disabled={pending || !token}
            onClick={() =>
              startTransition(async () => {
                const res = await fetch("/api/password-reset/confirm", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token, password }),
                });
                if (!res.ok) {
                  toast.error("Не удалось обновить пароль");
                  return;
                }
                toast.success("Пароль обновлён");
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
