"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="page-shell py-12">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Сброс пароля</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button
            className="w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await fetch("/api/password-reset", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                if (!res.ok) {
                  toast.error("Не удалось создать запрос");
                  return;
                }
                toast.success("Ссылка для сброса создана. Проверьте API-ответ или почтовый сервис.");
              })
            }
          >
            Отправить ссылку
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
